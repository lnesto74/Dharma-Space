import { mediaProxyUrl } from "./trainer-media-cache.js";

const IG_APP_ID = "936619743392459";
const DEFAULT_USERNAME = "dharma_space_sg";
const CACHE_MS = 60 * 60 * 1000;

export type InstagramFeedPost = {
  id: string;
  imageUrl: string;
  permalink: string;
  caption: string;
  mediaType: string;
};

export type InstagramFeedResponse = {
  username: string;
  profileUrl: string;
  posts: InstagramFeedPost[];
  cachedAt: string;
};

type CacheEntry = { expiresAt: number; data: InstagramFeedResponse };

let cache: CacheEntry | null = null;

function username() {
  return (process.env.INSTAGRAM_USERNAME || DEFAULT_USERNAME).replace(/^@/, "");
}

async function fetchViaGraphApi(): Promise<InstagramFeedPost[] | null> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const userId = process.env.INSTAGRAM_USER_ID?.trim();
  if (!token || !userId) return null;

  const url = new URL(`https://graph.instagram.com/${userId}/media`);
  url.searchParams.set(
    "fields",
    "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp"
  );
  url.searchParams.set("limit", "12");
  url.searchParams.set("access_token", token);

  const res = await fetch(url);
  if (!res.ok) return null;
  const body = (await res.json()) as {
    data?: Array<{
      id: string;
      caption?: string;
      media_type?: string;
      media_url?: string;
      thumbnail_url?: string;
      permalink?: string;
    }>;
  };

  return (body.data ?? [])
    .map((item) => {
      const imageUrl = item.media_url || item.thumbnail_url;
      if (!imageUrl || !item.permalink) return null;
      return {
        id: item.id,
        imageUrl: mediaProxyUrl(imageUrl),
        permalink: item.permalink,
        caption: item.caption?.trim() || "",
        mediaType: item.media_type || "IMAGE"
      } satisfies InstagramFeedPost;
    })
    .filter((item): item is InstagramFeedPost => Boolean(item));
}

async function fetchViaPublicProfile(handle: string): Promise<InstagramFeedPost[]> {
  const res = await fetch(
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`,
    {
      headers: {
        "x-ig-app-id": IG_APP_ID,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: `https://www.instagram.com/${handle}/`,
        Origin: "https://www.instagram.com"
      }
    }
  );

  if (!res.ok) {
    throw new Error(`Instagram profile fetch failed (${res.status})`);
  }

  const body = (await res.json()) as {
    data?: {
      user?: {
        edge_owner_to_timeline_media?: {
          edges?: Array<{
            node?: {
              id?: string;
              display_url?: string;
              thumbnail_src?: string;
              shortcode?: string;
              is_video?: boolean;
              edge_media_to_caption?: { edges?: Array<{ node?: { text?: string } }> };
            };
          }>;
        };
      };
    };
  };

  const edges = body.data?.user?.edge_owner_to_timeline_media?.edges ?? [];
  return edges
    .map((edge) => {
      const node = edge.node;
      const imageUrl = node?.display_url || node?.thumbnail_src;
      const shortcode = node?.shortcode;
      if (!node?.id || !imageUrl || !shortcode) return null;
      const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text?.trim() || "";
      return {
        id: node.id,
        imageUrl: mediaProxyUrl(imageUrl),
        permalink: `https://www.instagram.com/p/${shortcode}/`,
        caption,
        mediaType: node.is_video ? "VIDEO" : "IMAGE"
      } satisfies InstagramFeedPost;
    })
    .filter((item): item is InstagramFeedPost => Boolean(item));
}

export async function getInstagramFeed(): Promise<InstagramFeedResponse> {
  const handle = username();
  const now = Date.now();
  // Skip cache briefly after deploy so image URLs use the media proxy.
  if (cache && cache.expiresAt > now && cache.data.posts[0]?.imageUrl.startsWith("/api/media/proxy")) {
    return cache.data;
  }

  const graphPosts = await fetchViaGraphApi();
  const posts = graphPosts?.length ? graphPosts : await fetchViaPublicProfile(handle);

  const data: InstagramFeedResponse = {
    username: handle,
    profileUrl: `https://www.instagram.com/${handle}/`,
    posts: posts.slice(0, 12),
    cachedAt: new Date().toISOString()
  };

  cache = { expiresAt: now + CACHE_MS, data };
  return data;
}
