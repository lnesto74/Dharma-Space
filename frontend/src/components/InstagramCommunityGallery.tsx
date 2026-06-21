import { useEffect, useState } from "react";
import { Instagram } from "lucide-react";

type InstagramPost = {
  id: string;
  imageUrl: string;
  permalink: string;
  caption: string;
  mediaType: string;
};

type InstagramFeed = {
  username: string;
  profileUrl: string;
  posts: InstagramPost[];
};

type InstagramCommunityGalleryProps = {
  /** Large mosaic on Events page */
  variant?: "grid" | "strip";
  limit?: number;
  showFollowLink?: boolean;
};

export function InstagramCommunityGallery({
  variant = "grid",
  limit,
  showFollowLink = true
}: InstagramCommunityGalleryProps) {
  const [feed, setFeed] = useState<InstagramFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const postLimit = limit ?? (variant === "strip" ? 5 : 12);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/site/instagram-feed")
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load Instagram feed");
        return res.json() as Promise<InstagramFeed>;
      })
      .then((data) => {
        if (!cancelled) setFeed(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "Instagram feed unavailable");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    if (variant === "strip") {
      return (
        <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5 px-6 lg:px-12 max-w-7xl mx-auto">
          {Array.from({ length: postLimit }).map((_, i) => (
            <div key={i} className="aspect-square overflow-hidden bg-[#D4B896]/30 animate-pulse" />
          ))}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className={`overflow-hidden bg-[#D4B896]/30 animate-pulse ${i === 0 ? "md:col-span-2 md:row-span-2 aspect-square md:aspect-auto md:min-h-[300px]" : "aspect-square"}`}
          />
        ))}
      </div>
    );
  }

  if (error || !feed?.posts.length) {
    return (
      <div className="text-center py-12 border border-[#D4B896]/40 bg-[#FAF8F3] max-w-7xl mx-auto px-6 lg:px-12">
        <Instagram size={28} className="mx-auto mb-4 text-[#C4785A]" />
        <p className="text-[#2A2825]/70 text-[14px] mb-4" style={{ fontFamily: "var(--font-body)" }}>
          Follow our community on Instagram
        </p>
        <a
          href="https://www.instagram.com/dharma_space_sg/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#C4785A] text-white text-[11px] tracking-[0.15em] uppercase hover:bg-[#B86848] transition-colors"
          style={{ fontFamily: "var(--font-body)" }}
        >
          <Instagram size={14} /> @dharma_space_sg
        </a>
      </div>
    );
  }

  const posts = feed.posts.slice(0, postLimit);

  if (variant === "strip") {
    return (
      <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5 px-6 lg:px-12 max-w-7xl mx-auto">
        {posts.map((post) => (
          <a
            key={post.id}
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="group aspect-square overflow-hidden bg-[#D4B896]"
            aria-label="View on Instagram"
          >
            <img
              src={post.imageUrl}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
          </a>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {posts.map((post, i) => (
          <a
            key={post.id}
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className={`group block overflow-hidden bg-[#D4B896] ${i === 0 ? "md:col-span-2 md:row-span-2" : ""}`}
            aria-label="View on Instagram"
          >
            <img
              src={post.imageUrl}
              alt=""
              loading="lazy"
              className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${i === 0 ? "aspect-square md:aspect-auto md:min-h-[300px]" : "aspect-square"}`}
            />
          </a>
        ))}
      </div>
      {showFollowLink && (
        <div className="text-center mt-8">
          <a
            href={feed.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[#C4785A] text-[12px] tracking-[0.15em] uppercase hover:text-[#B86848] transition-colors"
            style={{ fontFamily: "var(--font-body)" }}
          >
            <Instagram size={14} /> Follow @{feed.username} on Instagram
          </a>
        </div>
      )}
    </div>
  );
}
