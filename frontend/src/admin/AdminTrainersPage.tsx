import { FormEvent, useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink, GraduationCap, Globe, LayoutGrid, Linkedin, List, Plus, RefreshCw, Upload } from "lucide-react";
import { AdminShell } from "./SiteAdminPages";
import { adminApi, uploadTrainerImage } from "./adminApi";

type Auth = { token: string; user: { name: string; role: string } | null };

type MediaLink = { type: string; url: string; caption?: string; thumbnailUrl?: string };

type Trainer = {
  id: string;
  name: string;
  role: string;
  description: string;
  credentials: string;
  imageUrl: string;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  galleryUrls?: string[];
  mediaLinks?: MediaLink[];
  scrapeMeta?: { lastScrapedAt?: string; warnings?: string[] };
  published: boolean;
  sortOrder: number;
};

type ScrapeJob = {
  id: string;
  status: string;
  progress: { message: string; finished: number; total: number };
  preview: Record<string, unknown> | null;
  warnings: string[];
  error: string | null;
};

const SCRAPE_FIELDS = [
  ["name", "Name"],
  ["role", "Role"],
  ["description", "Bio"],
  ["credentials", "Credentials"],
  ["imageUrl", "Profile photo"],
  ["websiteUrl", "Website URL"],
  ["instagramUrl", "Instagram URL"],
  ["linkedinUrl", "LinkedIn URL"],
  ["galleryUrls", "Gallery images (up to 6)"],
  ["mediaLinks", "Reels & posts (top 3)"]
] as const;

function mediaLinkScore(type: string | undefined): number {
  const t = (type || "").toLowerCase();
  if (t.includes("reel")) return 3;
  if (t.includes("video")) return 2;
  if (t.includes("post")) return 1;
  return 0;
}

function topMediaLinks(links: MediaLink[] | undefined, limit = 3): MediaLink[] {
  if (!links?.length) return [];
  return [...links]
    .sort((a, b) => {
      const diff = mediaLinkScore(b.type) - mediaLinkScore(a.type);
      if (diff !== 0) return diff;
      if (a.thumbnailUrl && !b.thumbnailUrl) return -1;
      if (b.thumbnailUrl && !a.thumbnailUrl) return 1;
      return 0;
    })
    .slice(0, limit);
}

function topGalleryUrls(urls: string[] | undefined, profileUrl?: string | null, limit = 6): string[] {
  if (!urls?.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    if (!url?.startsWith("http") && !url?.startsWith("/api/")) continue;
    if (profileUrl && url === profileUrl) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= limit) break;
  }
  return out;
}

function sourceTags(item: Trainer) {
  return (
    <div className="admin-trainer-sources">
      {item.websiteUrl && <span className="admin-tag"><Globe style={{ width: 10, height: 10, display: "inline" }} /> Web</span>}
      {item.instagramUrl && <span className="admin-tag">IG</span>}
      {item.linkedinUrl && <span className="admin-tag"><Linkedin style={{ width: 10, height: 10, display: "inline" }} /> LI</span>}
    </div>
  );
}

function TrainerThumb({ src, alt, className }: { src: string; alt?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return <div className={`admin-trainer-reel-placeholder${className ? ` ${className}` : ""}`}>No preview</div>;
  }
  return (
    <img
      src={src}
      alt={alt || ""}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

function TrainerMediaPreview({ trainer, compact }: { trainer: Partial<Trainer>; compact?: boolean }) {
  const gallery = topGalleryUrls(trainer.galleryUrls, trainer.imageUrl, compact ? 3 : 6);
  const media = topMediaLinks(trainer.mediaLinks, 3);
  const hasBio = Boolean(trainer.description?.trim());
  const hasCredentials = Boolean(trainer.credentials?.trim());

  if (!trainer.imageUrl && !hasBio && !gallery.length && !media.length && !hasCredentials) {
    return <p className="admin-trainer-empty-hint">No bio or media yet — fetch from Instagram or website after saving.</p>;
  }

  return (
    <div className={`admin-trainer-media${compact ? " admin-trainer-media-compact" : ""}`}>
      {trainer.imageUrl && (
        <div className="admin-trainer-profile-photo">
          <TrainerThumb src={trainer.imageUrl} alt={trainer.name || "Profile"} />
        </div>
      )}
      {hasBio && (
        <div className="admin-trainer-bio-block">
          <h4>Bio</h4>
          <p>{trainer.description}</p>
        </div>
      )}
      {hasCredentials && (
        <div className="admin-trainer-bio-block">
          <h4>Credentials</h4>
          <p>{trainer.credentials}</p>
        </div>
      )}
      {gallery.length > 0 && (
        <div className="admin-trainer-gallery-block">
          <h4>Gallery {gallery.length > 0 && <span className="admin-trainer-count">({gallery.length})</span>}</h4>
          <div className="admin-trainer-gallery-grid">
            {gallery.map((url) => (
              <a key={url} href={url.startsWith("/api/") ? "#" : url} target="_blank" rel="noreferrer" className="admin-trainer-thumb">
                <TrainerThumb src={url} />
              </a>
            ))}
          </div>
        </div>
      )}
      {media.length > 0 && (
        <div className="admin-trainer-gallery-block">
          <h4>Reels & posts <span className="admin-trainer-count">({media.length})</span></h4>
          <div className="admin-trainer-reels-grid">
            {media.map((m) => (
              <a key={m.url} href={m.url} target="_blank" rel="noreferrer" className="admin-trainer-reel-card">
                {m.thumbnailUrl ? (
                  <TrainerThumb src={m.thumbnailUrl} />
                ) : (
                  <div className="admin-trainer-reel-placeholder">{m.type || "post"}</div>
                )}
                <span className="admin-trainer-reel-meta">
                  <span className="admin-tag">{m.type || "post"}</span>
                  {m.caption && <span className="admin-trainer-reel-caption">{m.caption}</span>}
                  <ExternalLink style={{ width: 12, height: 12, flexShrink: 0 }} />
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TrainerAccordionItem({
  item,
  expanded,
  selected,
  onToggle,
  onEdit,
  onDelete
}: {
  item: Trainer;
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const galleryCount = topGalleryUrls(item.galleryUrls, item.imageUrl).length;
  const mediaCount = topMediaLinks(item.mediaLinks).length;

  return (
    <div className={`admin-trainer-accordion${expanded ? " open" : ""}${selected ? " selected" : ""}`}>
      <div className="admin-trainer-accordion-header">
        <button type="button" className="admin-trainer-accordion-toggle" onClick={onToggle} aria-expanded={expanded}>
          {item.imageUrl ? (
            <img src={item.imageUrl} alt="" className="admin-trainer-accordion-avatar" loading="lazy" />
          ) : (
            <span className="admin-trainer-accordion-avatar admin-trainer-accordion-avatar-empty">{item.name.slice(0, 1)}</span>
          )}
          <span className="admin-trainer-accordion-summary">
            <strong>{item.name}</strong>
            <span>{item.role}</span>
          </span>
          <span className="admin-trainer-accordion-badges">
            {galleryCount > 0 && <span className="admin-tag">{galleryCount} img</span>}
            {mediaCount > 0 && <span className="admin-tag">{mediaCount} reel</span>}
            {livePill(item.published)}
          </span>
          <ChevronDown className="admin-trainer-accordion-chevron" style={{ width: 16, height: 16 }} />
        </button>
        <div className="admin-trainer-accordion-actions">
          <button type="button" onClick={onEdit} className="admin-btn">Edit</button>
          <button type="button" onClick={onDelete} className="admin-btn admin-btn-danger">Delete</button>
        </div>
      </div>
      {expanded && (
        <div className="admin-trainer-accordion-body">
          {sourceTags(item)}
          <TrainerMediaPreview trainer={item} />
        </div>
      )}
    </div>
  );
}

function livePill(published: boolean) {
  return published
    ? <span className="admin-pill admin-pill-green"><span className="admin-pill-dot" />Live</span>
    : <span className="admin-pill admin-pill-gray"><span className="admin-pill-dot" />Draft</span>;
}

const emptyTrainer = (): Partial<Trainer> => ({
  name: "",
  role: "",
  description: "",
  credentials: "",
  imageUrl: "",
  websiteUrl: "",
  instagramUrl: "",
  linkedinUrl: "",
  published: true,
  sortOrder: 0
});

export function AdminSiteTrainersPage({ auth }: { auth: Auth }) {
  const [items, setItems] = useState<Trainer[]>([]);
  const [form, setForm] = useState<Partial<Trainer>>(emptyTrainer());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [scrapeMode, setScrapeMode] = useState<"extract" | "crawl">("extract");
  const [scrapeJob, setScrapeJob] = useState<ScrapeJob | null>(null);
  const [applyFields, setApplyFields] = useState<string[]>(["description", "imageUrl", "credentials", "galleryUrls", "mediaLinks"]);
  const [viewMode, setViewMode] = useState<"accordion" | "table">("accordion");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [pendingProfileFile, setPendingProfileFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<number | null>(null);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const load = () => {
    setLoading(true);
    adminApi<{ trainers: Trainer[] }>("/api/admin/site/trainers", auth.token)
      .then((d) => setItems(d.trainers))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); return () => { if (pollRef.current) window.clearInterval(pollRef.current); }; }, [auth.token]);

  useEffect(() => {
    return () => {
      if (profilePreview?.startsWith("blob:")) URL.revokeObjectURL(profilePreview);
    };
  }, [profilePreview]);

  const uploadImage = async (file: File, field: "profile" | "gallery", trainerId: string) => {
    setUploading(true);
    setError("");
    try {
      const res = await uploadTrainerImage(trainerId, auth.token, file, field);
      setForm(res.trainer as Partial<Trainer>);
      if (field === "profile") {
        setPendingProfileFile(null);
        if (profilePreview?.startsWith("blob:")) URL.revokeObjectURL(profilePreview);
        setProfilePreview(null);
      }
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const onProfileFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (JPG, PNG, or WebP).");
      return;
    }
    if (editingId) {
      await uploadImage(file, "profile", editingId);
      return;
    }
    setPendingProfileFile(file);
    if (profilePreview?.startsWith("blob:")) URL.revokeObjectURL(profilePreview);
    setProfilePreview(URL.createObjectURL(file));
  };

  const onGalleryFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!editingId) {
      setError("Save the trainer first, then upload gallery images.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        await uploadTrainerImage(editingId, auth.token, file, "gallery");
      }
      const latest = await adminApi<{ trainers: Trainer[] }>("/api/admin/site/trainers", auth.token);
      const updated = latest.trainers.find((t) => t.id === editingId);
      if (updated) setForm(updated);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const payload = {
        ...form,
        galleryUrls: form.galleryUrls ?? [],
        mediaLinks: form.mediaLinks ?? []
      };
      let trainerId = editingId;
      if (trainerId) {
        const res = await adminApi<{ trainer: Trainer }>(`/api/admin/site/trainers/${trainerId}`, auth.token, { method: "PUT", body: JSON.stringify(payload) });
        setForm(res.trainer);
      } else {
        const res = await adminApi<{ trainer: Trainer }>("/api/admin/site/trainers", auth.token, { method: "POST", body: JSON.stringify(payload) });
        trainerId = res.trainer.id;
        setEditingId(trainerId);
        setForm(res.trainer);
      }
      if (pendingProfileFile && trainerId) {
        await uploadImage(pendingProfileFile, "profile", trainerId);
      } else {
        load();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this trainer?")) return;
    await adminApi(`/api/admin/site/trainers/${id}`, auth.token, { method: "DELETE" });
    if (editingId === id) { setEditingId(null); setForm(emptyTrainer()); }
    load();
  };

  const startEdit = (item: Trainer) => {
    setEditingId(item.id);
    setForm({ ...item });
    setScrapeJob(null);
    setPendingProfileFile(null);
    if (profilePreview?.startsWith("blob:")) URL.revokeObjectURL(profilePreview);
    setProfilePreview(null);
    setExpandedIds((prev) => new Set(prev).add(item.id));
  };

  const pollJob = (jobId: string) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const job = await adminApi<ScrapeJob>(`/api/admin/site/trainers/scrape/${jobId}`, auth.token);
        setScrapeJob(job);
        if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
          if (pollRef.current) window.clearInterval(pollRef.current);
        }
      } catch {
        if (pollRef.current) window.clearInterval(pollRef.current);
      }
    }, 2000);
  };

  const startScrape = async () => {
    if (!editingId) {
      setError("Save the trainer first, then scrape.");
      return;
    }
    const instagram = (form.instagramUrl || "").trim();
    const website = (form.websiteUrl || "").trim();
    const linkedin = (form.linkedinUrl || "").trim();
    if (!instagram && !website && !linkedin) {
      setError("Add an Instagram URL (e.g. https://www.instagram.com/dharma_space_sg/), website, or LinkedIn first.");
      return;
    }
    setError("");
    setScrapeJob(null);
    try {
      const res = await adminApi<{ jobId: string }>(`/api/admin/site/trainers/${editingId}/scrape`, auth.token, {
        method: "POST",
        body: JSON.stringify({
          websiteUrl: website || null,
          instagramUrl: instagram || null,
          linkedinUrl: linkedin || null,
          mode: scrapeMode
        })
      });
      pollJob(res.jobId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const applyScrape = async () => {
    if (!scrapeJob?.id) return;
    setError("");
    try {
      const res = await adminApi<{ trainer: Trainer }>(`/api/admin/site/trainers/scrape/${scrapeJob.id}/apply`, auth.token, {
        method: "POST",
        body: JSON.stringify({ fields: applyFields })
      });
      setForm(res.trainer);
      setScrapeJob(null);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleApplyField = (field: string) => {
    setApplyFields((prev) => prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]);
  };

  const preview = scrapeJob?.preview as Record<string, unknown> | null | undefined;
  const lastScraped = form.scrapeMeta?.lastScrapedAt
    ? new Date(form.scrapeMeta.lastScrapedAt).toLocaleString()
    : null;

  const hasSourceUrl = Boolean(form.websiteUrl?.trim() || form.instagramUrl?.trim() || form.linkedinUrl?.trim());
  const profileDisplayUrl = profilePreview || form.imageUrl || "";

  const uploadBlock = (
    <div className="admin-upload-block">
      <h3 className="admin-panel-title">Photos</h3>
      <div className="admin-upload-profile">
        {(profileDisplayUrl) ? (
          <TrainerThumb src={profileDisplayUrl} alt={form.name || "Profile"} className="admin-upload-preview" />
        ) : (
          <div className="admin-upload-preview admin-upload-preview-empty">No photo</div>
        )}
        <div className="admin-upload-actions">
          <input
            ref={profileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="admin-upload-input"
            onChange={(e) => onProfileFile(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            disabled={uploading}
            onClick={() => profileInputRef.current?.click()}
          >
            <Upload style={{ width: 14, height: 14 }} />
            {uploading ? "Uploading…" : "Upload profile photo"}
          </button>
          {!editingId && (
            <p className="admin-import-hint">New trainer: pick a photo now — it uploads when you Save.</p>
          )}
        </div>
      </div>
      <div className="admin-upload-gallery">
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="admin-upload-input"
          onChange={(e) => onGalleryFiles(e.target.files)}
        />
        <button
          type="button"
          className="admin-btn"
          disabled={uploading || !editingId}
          onClick={() => galleryInputRef.current?.click()}
        >
          <Upload style={{ width: 14, height: 14 }} />
          Add gallery images
        </button>
        {!editingId && (
          <p className="admin-import-hint">Save once, then add extra gallery photos here.</p>
        )}
      </div>
    </div>
  );

  const importBlock = (
    <div className="admin-import-block">
      <h3 className="admin-panel-title">Import from web</h3>
      {!editingId ? (
        <p className="admin-import-hint">Save the trainer once, then you can fetch bio, photo, and gallery from the URLs above.</p>
      ) : (
        <>
          {lastScraped && <p className="admin-import-hint">Last imported {lastScraped}</p>}
          {!hasSourceUrl && (
            <p className="admin-import-hint">Add a Website, Instagram, or LinkedIn URL above, then click Fetch profile.</p>
          )}
          <label className="admin-field">
            <span className="admin-field-label">Mode</span>
            <select value={scrapeMode} onChange={(e) => setScrapeMode(e.target.value as "extract" | "crawl")} className="admin-input">
              <option value="extract">Extract (single page per source)</option>
              <option value="crawl">Crawl website (multi-page)</option>
            </select>
          </label>
          <button
            type="button"
            onClick={startScrape}
            disabled={!hasSourceUrl}
            className="admin-btn admin-btn-primary"
            style={{ width: "100%" }}
          >
            <Globe style={{ width: 14, height: 14 }} /> Fetch profile
          </button>
          {scrapeJob && scrapeJob.status !== "completed" && scrapeJob.status !== "failed" && (
            <p style={{ fontSize: 13, color: "var(--admin-text-secondary)", marginTop: 10 }}>{scrapeJob.progress.message}</p>
          )}
          {scrapeJob?.error && <div className="admin-alert" style={{ marginTop: 10 }}>{scrapeJob.error}</div>}
          {(scrapeJob?.warnings?.length ?? 0) > 0 && (
            <div className="admin-alert admin-alert-warn" style={{ fontSize: 12, marginTop: 10 }}>
              {scrapeJob!.warnings.join(" ")}
            </div>
          )}
          {preview && scrapeJob?.status === "completed" && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--admin-text)" }}>Preview — select fields to apply</p>
              {SCRAPE_FIELDS.map(([field, label]) => {
                const val = preview[field];
                if (val == null || val === "" || (Array.isArray(val) && !val.length)) return null;
                const display = Array.isArray(val) ? `${val.length} items` : String(val).slice(0, 80);
                return (
                  <label key={field} className="admin-field-checkbox">
                    <input type="checkbox" checked={applyFields.includes(field)} onChange={() => toggleApplyField(field)} />
                    <span><strong>{label}:</strong> {display}{String(val).length > 80 ? "…" : ""}</span>
                  </label>
                );
              })}
              {typeof preview.imageUrl === "string" && preview.imageUrl ? (
                <img src={preview.imageUrl} alt="Preview" style={{ width: "100%", maxHeight: 120, objectFit: "cover", borderRadius: 4, marginBottom: 8 }} />
              ) : null}
              <TrainerMediaPreview
                trainer={{
                  imageUrl: typeof preview.imageUrl === "string" ? preview.imageUrl : undefined,
                  description: typeof preview.description === "string" ? preview.description : undefined,
                  galleryUrls: Array.isArray(preview.galleryUrls) ? preview.galleryUrls as string[] : [],
                  mediaLinks: Array.isArray(preview.mediaLinks) ? preview.mediaLinks as MediaLink[] : []
                }}
                compact
              />
              <button type="button" onClick={applyScrape} className="admin-btn admin-btn-primary" style={{ width: "100%", marginTop: 8 }}>
                Apply selected
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  const toolbar = (
    <div className="admin-view-tabs">
      <button type="button" className={`admin-view-tab${viewMode === "accordion" ? " active" : ""}`} onClick={() => setViewMode("accordion")}>
        <List /> All
      </button>
      <button type="button" className={`admin-view-tab${viewMode === "table" ? " active" : ""}`} onClick={() => setViewMode("table")}>
        <LayoutGrid /> Table
      </button>
    </div>
  );

  return (
    <AdminShell auth={auth} title="Trainers" subtitle="Specialists on the About page. Import bios and photos from website, Instagram, or LinkedIn." icon={GraduationCap} toolbar={toolbar}>
      {error && <div className="admin-alert">{error}</div>}

      <div className="admin-layout-split">
        <div className="admin-layout-main">
          <div className="admin-db-toolbar">
            <span style={{ fontSize: 13, color: "var(--admin-text-tertiary)" }}>All trainers</span>
            <div className="admin-db-toolbar-spacer" />
            <button type="button" onClick={load} className="admin-btn"><RefreshCw style={{ width: 14, height: 14 }} /> Refresh</button>
            <button type="button" onClick={() => { setEditingId(null); setForm(emptyTrainer()); setScrapeJob(null); setPendingProfileFile(null); if (profilePreview?.startsWith("blob:")) URL.revokeObjectURL(profilePreview); setProfilePreview(null); }} className="admin-btn admin-btn-primary">
              <Plus style={{ width: 14, height: 14 }} /> New
            </button>
          </div>

          {loading ? (
            <div className="admin-loading">Loading…</div>
          ) : viewMode === "accordion" ? (
            <div className="admin-trainer-list">
              {items.map((item) => (
                <TrainerAccordionItem
                  key={item.id}
                  item={item}
                  expanded={expandedIds.has(item.id)}
                  selected={editingId === item.id}
                  onToggle={() => toggleExpanded(item.id)}
                  onEdit={() => startEdit(item)}
                  onDelete={() => remove(item.id)}
                />
              ))}
              {!items.length && <p className="admin-trainer-list-empty">No trainers yet.</p>}
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Name</th><th>Role</th><th>Sources</th><th>Media</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className={editingId === item.id ? "admin-row-selected" : undefined} onClick={() => startEdit(item)}>
                      <td className="admin-td-name">{item.name}</td>
                      <td>{item.role}</td>
                      <td>{sourceTags(item)}</td>
                      <td>
                        <span className="admin-tag">{topGalleryUrls(item.galleryUrls, item.imageUrl).length} img</span>
                        {" "}
                        <span className="admin-tag">{topMediaLinks(item.mediaLinks).length} reel</span>
                      </td>
                      <td>{livePill(item.published)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="admin-table-actions">
                          <button type="button" onClick={() => remove(item.id)} className="admin-btn admin-btn-danger">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!items.length && <tr className="admin-table-empty"><td colSpan={6}>No trainers yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="admin-panel">
          <h2 className="admin-panel-title">{editingId ? "Edit properties" : "New trainer"}</h2>
          {!editingId && (
            <p className="admin-import-hint" style={{ marginTop: -8, marginBottom: 12 }}>
              Click a trainer in the table to edit, or use New to create one.
            </p>
          )}
          <form onSubmit={save}>
            {[
              ["name", "Name"],
              ["role", "Role"],
            ].map(([key, label]) => (
              <label key={key} className="admin-field">
                <span className="admin-field-label">{label}</span>
                <input type="text" value={String((form as any)[key] ?? "")} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="admin-input" />
              </label>
            ))}

            {[
              ["websiteUrl", "Website URL"],
              ["instagramUrl", "Instagram (@handle or URL)"],
              ["linkedinUrl", "LinkedIn profile URL"],
            ].map(([key, label]) => (
              <label key={key} className="admin-field">
                <span className="admin-field-label">{label}</span>
                <input type="text" value={String((form as any)[key] ?? "")} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="admin-input" />
              </label>
            ))}

            {importBlock}

            {uploadBlock}

            {[
              ["description", "Bio", "textarea"],
              ["credentials", "Credentials"],
              ["sortOrder", "Sort order", "number"]
            ].map(([key, label, type]) => (
              <label key={key} className="admin-field">
                <span className="admin-field-label">{label}</span>
                {type === "textarea" ? (
                  <textarea rows={3} value={String((form as any)[key] ?? "")} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="admin-textarea" />
                ) : (
                  <input type={type || "text"} value={String((form as any)[key] ?? "")} onChange={(e) => setForm({ ...form, [key]: type === "number" ? Number(e.target.value) : e.target.value })} className="admin-input" />
                )}
              </label>
            ))}
            <label className="admin-field-checkbox">
              <input type="checkbox" checked={Boolean(form.published)} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
              Published on website
            </label>

            {editingId && (
              <div className="admin-trainer-saved-media">
                <h3 className="admin-panel-title">Saved media</h3>
                <TrainerMediaPreview trainer={form} compact />
              </div>
            )}

            <div className="admin-form-actions">
              <button type="submit" className="admin-btn admin-btn-primary">Save</button>
              {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyTrainer()); setScrapeJob(null); setPendingProfileFile(null); if (profilePreview?.startsWith("blob:")) URL.revokeObjectURL(profilePreview); setProfilePreview(null); }} className="admin-btn">Cancel</button>}
            </div>
          </form>
        </div>
      </div>
    </AdminShell>
  );
}
