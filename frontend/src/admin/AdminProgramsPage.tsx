import { FormEvent, useEffect, useRef, useState } from "react";
import { BookOpen, Plus, RefreshCw, Type, Upload, List } from "lucide-react";
import { AdminShell } from "./SiteAdminPages";
import { adminApi, uploadProgramImage } from "./adminApi";
import {
  defaultDurationForCategory,
  durationFieldHint,
  durationPresetsForCategory,
  EVENT_WORKSHOP_DURATIONS,
  TRAINING_DURATIONS
} from "../lib/program-duration";
import {
  defaultComingSoonForCategory,
  inputTimeToMinutes,
  isSessionProgram,
  isTrainingProgram,
  minutesToInputTime,
  programDisplayDate
} from "../lib/program-schedule";
import {
  CLASS_SIZE_OPTIONS,
  classSizeSelectValue,
  normalizeSgdPrice,
  sgdPriceAmount,
  STRIPE_LINK_HINT,
  isValidStripeLink
} from "../lib/program-form";
import { stripeBookingReturnUrl } from "../lib/stripe-booking";

type TrainerOption = { id: string; name: string };

type Auth = { token: string; user: { name: string; role: string } | null };

const CATEGORY_TABS = [
  { key: "ALL", label: "All" },
  { key: "FLAGSHIP", label: "Flagship program" },
  { key: "CERTIFICATION", label: "Courses" },
  { key: "WORKSHOP", label: "Workshops" },
  { key: "EVENT", label: "Events" }
] as const;

type CategoryTab = (typeof CATEGORY_TABS)[number]["key"];

const CATEGORY_OPTIONS = [
  ["FLAGSHIP", "Flagship program"],
  ["CERTIFICATION", "Course"],
  ["WORKSHOP", "Workshop"],
  ["EVENT", "Event"]
] as const;

function categoryLabel(category: string) {
  const normalized = category.toUpperCase();
  if (normalized === "FLAGSHIP" || normalized === "YTT") return "Flagship program";
  if (normalized === "CERTIFICATION" || normalized === "COURSE") return "Course";
  if (normalized === "WORKSHOP") return "Workshop";
  if (normalized === "EVENT") return "Event";
  return category;
}

function categoryTabLabel(key: CategoryTab) {
  return CATEGORY_TABS.find((tab) => tab.key === key)?.label ?? "All";
}

type ProgramRow = {
  id: string;
  category: string;
  title: string;
  description: string;
  comingSoon: boolean;
  scheduledDate: string;
  startMinutes: number;
  dates: string;
  duration: string;
  time: string;
  location: string;
  facilitator: string;
  price: string;
  certificationLabel: string;
  classSize: string;
  curriculumItems: string | string[];
  badgeTitle: string;
  badgeSubtitle: string;
  imageUrl: string;
  stripeLink?: string | null;
  usePayNow: boolean;
  code?: string | null;
  depositAmount?: string | null;
  singlePerson: boolean;
  published: boolean;
  sortOrder: number;
  bookingCount?: number;
  capacity?: number | null;
  spotsRemaining?: number | null;
  soldOut?: boolean;
  finished?: boolean;
  status?: "COMING_SOON" | "SCHEDULED" | "FINISHED";
};

function livePill(published: boolean) {
  return published
    ? <span className="admin-pill admin-pill-green"><span className="admin-pill-dot" />Live</span>
    : <span className="admin-pill admin-pill-gray"><span className="admin-pill-dot" />Draft</span>;
}

function schedulePill(comingSoon: boolean, finished?: boolean) {
  if (finished) {
    return <span className="admin-pill admin-pill-gray"><span className="admin-pill-dot" />Finished</span>;
  }
  return comingSoon
    ? <span className="admin-pill admin-pill-orange"><span className="admin-pill-dot" />Coming soon</span>
    : <span className="admin-pill admin-pill-green"><span className="admin-pill-dot" />Scheduled</span>;
}

function soldOutPill(soldOut: boolean) {
  return soldOut
    ? <span className="admin-pill admin-pill-orange"><span className="admin-pill-dot" />Sold out</span>
    : null;
}

function emptyProgram(category = "WORKSHOP"): Record<string, unknown> {
  return {
    category,
    title: "",
    description: "",
    comingSoon: defaultComingSoonForCategory(category),
    scheduledDate: "",
    startMinutes: 10 * 60,
    dates: "Coming Soon",
    duration: defaultDurationForCategory(category),
    time: "",
    location: "Dharma Space Studio",
    facilitator: "",
    price: "",
    certificationLabel: "",
    classSize: "15",
    curriculumItems: "[]",
    badgeTitle: "",
    badgeSubtitle: "",
    imageUrl: "",
    stripeLink: "",
    usePayNow: false,
    code: "",
    depositAmount: "",
    singlePerson: true,
    published: true,
    sortOrder: 0
  };
}

function DurationPresetField({
  label,
  value,
  presets,
  hint,
  onChange
}: {
  label: string;
  value: string;
  presets: string[];
  hint?: string;
  onChange: (value: string) => void;
}) {
  const [usePreset, setUsePreset] = useState(() => !value || presets.includes(value));

  useEffect(() => {
    if (value && presets.includes(value)) setUsePreset(true);
  }, [presets, value]);

  return (
    <label className="admin-field">
      <span className="admin-field-label">{label}</span>
      <div className="admin-preset-row">
        <button
          type="button"
          className="admin-preset-toggle"
          title={usePreset ? "Type manually" : "Pick from list"}
          onClick={() => setUsePreset((prev) => !prev)}
        >
          {usePreset ? <List size={14} /> : <Type size={14} />}
        </button>
        {usePreset ? (
          <select value={value} onChange={(e) => onChange(e.target.value)} className="admin-input">
            <option value="">Select…</option>
            {presets.map((item) => <option key={item} value={item}>{item}</option>)}
            {value && !presets.includes(value) ? <option value={value}>{value}</option> : null}
          </select>
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="admin-input"
            placeholder={`Enter ${label.toLowerCase()}`}
          />
        )}
      </div>
      {hint && <span className="admin-field-hint">{hint}</span>}
    </label>
  );
}

export function AdminSiteProgramsPage({ auth }: { auth: Auth }) {
  const [items, setItems] = useState<ProgramRow[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<CategoryTab>("ALL");
  const [form, setForm] = useState<Record<string, unknown>>(emptyProgram());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const category = String(form.category ?? "WORKSHOP");
  const comingSoon = Boolean(form.comingSoon);
  const sessionProgram = isSessionProgram(category);
  const trainingProgram = isTrainingProgram(category);

  const load = () => {
    setLoading(true);
    const url = categoryFilter === "ALL"
      ? "/api/admin/site/programs"
      : `/api/admin/site/programs?category=${categoryFilter}`;
    adminApi<{ programs: ProgramRow[] }>(url, auth.token)
      .then((data) => setItems(data.programs))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [auth.token, categoryFilter]);

  useEffect(() => {
    adminApi<{ trainers: TrainerOption[] }>("/api/admin/site/trainers", auth.token)
      .then((data) => setTrainers(data.trainers.map((t) => ({ id: t.id, name: t.name }))))
      .catch(() => {});
  }, [auth.token]);

  const setCategory = (nextCategory: string) => {
    const presets = durationPresetsForCategory(nextCategory);
    const currentDuration = String(form.duration ?? "");
    const next: Record<string, unknown> = {
      ...form,
      category: nextCategory,
      comingSoon: defaultComingSoonForCategory(nextCategory)
    };
    if (!currentDuration || !presets.includes(currentDuration)) {
      next.duration = defaultDurationForCategory(nextCategory);
    }
    if (next.comingSoon) {
      next.scheduledDate = "";
      next.dates = "Coming Soon";
      next.stripeLink = "";
    }
    setForm(next);
  };

  const setComingSoon = (checked: boolean) => {
    const next: Record<string, unknown> = { ...form, comingSoon: checked };
    if (checked) {
      next.scheduledDate = "";
      next.dates = "Coming Soon";
      next.stripeLink = "";
    }
    setForm(next);
  };

  const startNew = () => {
    setEditingId(null);
    const defaultCategory = categoryFilter === "ALL" ? "WORKSHOP" : categoryFilter;
    setForm(emptyProgram(defaultCategory));
    setError("");
  };

  const startEdit = (item: ProgramRow) => {
    setEditingId(item.id);
    const next: Record<string, unknown> = { ...item };
    if (Array.isArray(next.curriculumItems)) {
      next.curriculumItems = next.curriculumItems.join("\n");
    }
    if (!next.startMinutes) next.startMinutes = 10 * 60;
    const selectedSize = classSizeSelectValue(String(next.classSize ?? ""));
    if (selectedSize) next.classSize = selectedSize;
    setForm(next);
    setError("");
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!comingSoon && sessionProgram && !String(form.scheduledDate ?? "").trim()) {
      setError("Pick a date or mark as Coming soon.");
      return;
    }
    if (!comingSoon && trainingProgram && !String(form.dates ?? "").trim()) {
      setError("Enter intake dates or mark as Coming soon.");
      return;
    }
    const stripeLink = String(form.stripeLink ?? "").trim();
    if (!comingSoon && !Boolean(form.usePayNow)) {
      if (!stripeLink || !isValidStripeLink(stripeLink)) {
        setError("Stripe payment link is required when a date is scheduled (unless using PayNow).");
        return;
      }
    }
    if (comingSoon && stripeLink) {
      setError("Remove the Stripe link — coming soon items use Reserve Spot, not Stripe checkout.");
      return;
    }

    try {
      const payload = {
        ...form,
        price: normalizeSgdPrice(String(form.price ?? "")),
        stripeLink: comingSoon ? null : stripeLink || null
      };
      if (editingId) {
        await adminApi(`/api/admin/site/programs/${editingId}`, auth.token, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
      } else {
        await adminApi("/api/admin/site/programs", auth.token, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }
      setForm(emptyProgram());
      setEditingId(null);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    await adminApi(`/api/admin/site/programs/${id}`, auth.token, { method: "DELETE" });
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyProgram());
    }
    load();
  };

  const durationPresets = sessionProgram ? [...EVENT_WORKSHOP_DURATIONS] : [...TRAINING_DURATIONS];

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    setError("");
    try {
      const res = await uploadProgramImage(auth.token, file, editingId ?? undefined);
      setForm((prev) => ({ ...prev, imageUrl: res.url }));
      if (res.program) {
        setForm((prev) => ({ ...prev, ...res.program }));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const bookingCount = Number(form.bookingCount ?? 0);
  const capacity = form.capacity != null ? Number(form.capacity) : parseInt(String(form.classSize ?? ""), 10) || null;

  return (
    <AdminShell
      auth={auth}
      title="Education & Events"
      subtitle="Publish workshops early with Coming soon, or schedule with a date and time."
      icon={BookOpen}
      toolbar={(
        <div className="admin-view-tabs">
          {CATEGORY_TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`admin-view-tab${categoryFilter === key ? " active" : ""}`}
              onClick={() => setCategoryFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    >
      {error && <div className="admin-alert">{error}</div>}

      <div className="admin-layout-split">
        <div className="admin-layout-main">
          <div className="admin-db-toolbar">
            <span style={{ fontSize: 13, color: "var(--admin-text-tertiary)" }}>
              {categoryFilter === "ALL" ? "All education & events" : categoryTabLabel(categoryFilter)}
              {!loading && ` · ${items.length} item${items.length === 1 ? "" : "s"}`}
            </span>
            <div className="admin-db-toolbar-spacer" />
            <button type="button" onClick={load} className="admin-btn"><RefreshCw style={{ width: 14, height: 14 }} /> Refresh</button>
            <button type="button" onClick={startNew} className="admin-btn admin-btn-primary"><Plus style={{ width: 14, height: 14 }} /> New</button>
          </div>

          {loading ? (
            <div className="admin-loading">Loading…</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Category</th><th>Title</th><th>Schedule</th><th>Price</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className={editingId === item.id ? "admin-row-selected" : undefined} onClick={() => startEdit(item)}>
                      <td className="admin-td-name">{categoryLabel(item.category)}</td>
                      <td>{item.title}</td>
                      <td>
                        <div style={{ display: "grid", gap: 4 }}>
                          {schedulePill(item.comingSoon, item.finished || item.status === "FINISHED")}
                          {soldOutPill(Boolean(item.soldOut))}
                          <span style={{ fontSize: 12, color: "var(--admin-text-secondary)" }}>{programDisplayDate(item)}</span>
                        </div>
                      </td>
                      <td>{item.price}</td>
                      <td>{livePill(item.published)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="admin-table-actions">
                          <button type="button" onClick={() => startEdit(item)} className="admin-btn">Edit</button>
                          <button type="button" onClick={() => remove(item.id)} className="admin-btn admin-btn-danger">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!items.length && (
                    <tr className="admin-table-empty">
                      <td colSpan={6}>
                        {categoryFilter === "ALL"
                          ? "No items yet — click New to add one."
                          : `No ${categoryTabLabel(categoryFilter).toLowerCase()} yet — click New to add one.`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="admin-panel">
          <h2 className="admin-panel-title">{editingId ? "Edit item" : "New item"}</h2>
          <form onSubmit={save}>
            <label className="admin-field">
              <span className="admin-field-label">Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="admin-input">
                {CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            <label className="admin-field">
              <span className="admin-field-label">Title</span>
              <input type="text" value={String(form.title ?? "")} onChange={(e) => setForm({ ...form, title: e.target.value })} className="admin-input" required />
            </label>

            <label className="admin-field">
              <span className="admin-field-label">Description</span>
              <textarea rows={3} value={String(form.description ?? "")} onChange={(e) => setForm({ ...form, description: e.target.value })} className="admin-textarea" />
            </label>

            <label className="admin-field-checkbox">
              <input type="checkbox" checked={comingSoon} onChange={(e) => setComingSoon(e.target.checked)} />
              Coming soon — date not confirmed yet
            </label>
            {!comingSoon && (
              <span className="admin-field-hint" style={{ display: "block", marginTop: -8, marginBottom: 12 }}>
                {sessionProgram
                  ? "Pick the session date and start time below."
                  : "Enter intake dates and weekly schedule below."}
              </span>
            )}

            {!comingSoon && sessionProgram && (
              <>
                <label className="admin-field">
                  <span className="admin-field-label">Date</span>
                  <input
                    type="date"
                    value={String(form.scheduledDate ?? "")}
                    onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                    className="admin-input"
                    required
                  />
                </label>
                <label className="admin-field">
                  <span className="admin-field-label">Start time</span>
                  <input
                    type="time"
                    value={minutesToInputTime(Number(form.startMinutes ?? 600))}
                    onChange={(e) => setForm({ ...form, startMinutes: inputTimeToMinutes(e.target.value) })}
                    className="admin-input"
                    step={900}
                  />
                </label>
              </>
            )}

            {!comingSoon && trainingProgram && (
              <>
                <label className="admin-field">
                  <span className="admin-field-label">Next intake / dates</span>
                  <input
                    type="text"
                    value={String(form.dates ?? "")}
                    onChange={(e) => setForm({ ...form, dates: e.target.value })}
                    className="admin-input"
                    placeholder="e.g. Sep 11 – Oct 6, 2026"
                    required
                  />
                </label>
                <label className="admin-field">
                  <span className="admin-field-label">Intake start date (optional)</span>
                  <input
                    type="date"
                    value={String(form.scheduledDate ?? "")}
                    onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                    className="admin-input"
                  />
                </label>
              </>
            )}

            <DurationPresetField
              label="Duration"
              value={String(form.duration ?? "")}
              presets={durationPresets}
              hint={durationFieldHint(category)}
              onChange={(duration) => setForm({ ...form, duration })}
            />

            {(trainingProgram || comingSoon) && (
              <label className="admin-field">
                <span className="admin-field-label">Schedule</span>
                <input
                  type="text"
                  value={String(form.time ?? "")}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  className="admin-input"
                  placeholder={trainingProgram ? "e.g. Thu 7–9PM · Sat & Sun 2–9PM" : "Optional until date is confirmed"}
                />
              </label>
            )}

            <label className="admin-field">
              <span className="admin-field-label">Location</span>
              <input type="text" value={String(form.location ?? "")} onChange={(e) => setForm({ ...form, location: e.target.value })} className="admin-input" />
            </label>

            <label className="admin-field">
              <span className="admin-field-label">Trainer</span>
              <select
                value={String(form.facilitator ?? "")}
                onChange={(e) => setForm({ ...form, facilitator: e.target.value })}
                className="admin-input"
              >
                <option value="">Select trainer…</option>
                {trainers.map((trainer) => <option key={trainer.id} value={trainer.name}>{trainer.name}</option>)}
                {form.facilitator && !trainers.some((t) => t.name === form.facilitator) ? (
                  <option value={String(form.facilitator)}>{String(form.facilitator)}</option>
                ) : null}
              </select>
            </label>

            <label className="admin-field">
              <span className="admin-field-label">Price (SGD)</span>
              <div className="admin-preset-row">
                <span className="admin-preset-toggle" style={{ cursor: "default" }}>SGD</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={sgdPriceAmount(String(form.price ?? ""))}
                  onChange={(e) => setForm({ ...form, price: normalizeSgdPrice(e.target.value) })}
                  className="admin-input"
                  placeholder="95"
                />
              </div>
            </label>

            <label className="admin-field">
              <span className="admin-field-label">Class size (max spots)</span>
              <select
                value={String(form.classSize ?? "")}
                onChange={(e) => setForm({ ...form, classSize: e.target.value })}
                className="admin-input"
              >
                <option value="">Select…</option>
                {CLASS_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              {sessionProgram && capacity ? (
                <span className="admin-field-hint">
                  Bookings: {bookingCount} / {capacity}
                  {Boolean(form.soldOut) ? " · SOLD OUT on website" : capacity > bookingCount ? ` · ${capacity - bookingCount} spots left` : ""}
                </span>
              ) : null}
            </label>

            {trainingProgram && (
              <>
                <label className="admin-field">
                  <span className="admin-field-label">Certification label</span>
                  <input type="text" value={String(form.certificationLabel ?? "")} onChange={(e) => setForm({ ...form, certificationLabel: e.target.value })} className="admin-input" />
                </label>
                <label className="admin-field">
                  <span className="admin-field-label">Badge title (e.g. RYT 200)</span>
                  <input type="text" value={String(form.badgeTitle ?? "")} onChange={(e) => setForm({ ...form, badgeTitle: e.target.value })} className="admin-input" />
                </label>
                <label className="admin-field">
                  <span className="admin-field-label">Badge subtitle</span>
                  <input type="text" value={String(form.badgeSubtitle ?? "")} onChange={(e) => setForm({ ...form, badgeSubtitle: e.target.value })} className="admin-input" />
                </label>
              </>
            )}

            <div className="admin-field">
              <span className="admin-field-label">Hero image</span>
              {form.imageUrl ? (
                <img
                  src={String(form.imageUrl)}
                  alt=""
                  style={{ width: "100%", maxHeight: 140, objectFit: "cover", borderRadius: 4, marginBottom: 8 }}
                />
              ) : null}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className="admin-btn"
                disabled={uploadingImage}
                onClick={() => imageInputRef.current?.click()}
              >
                <Upload size={14} /> {uploadingImage ? "Uploading…" : "Upload photo"}
              </button>
              <span className="admin-field-hint">JPEG/PNG up to 8 MB. Saves to this item when editing; otherwise uploads and sets URL on save.</span>
            </div>

            {!comingSoon && !Boolean(form.usePayNow) && (
            <label className="admin-field">
              <span className="admin-field-label">Stripe payment link *</span>
              <input
                type="url"
                value={String(form.stripeLink ?? "")}
                onChange={(e) => setForm({ ...form, stripeLink: e.target.value })}
                className="admin-input"
                placeholder="https://buy.stripe.com/..."
                required
              />
              <span className="admin-field-hint">
                {STRIPE_LINK_HINT} Redirect URL: {stripeBookingReturnUrl()}
              </span>
            </label>
            )}
            {comingSoon && (
              <p className="admin-field-hint" style={{ marginBottom: 12 }}>
                Coming soon — no Stripe link. Visitors use Reserve Spot; enquiries go to your inbox and vera@dharma-space.com.
              </p>
            )}

            {[
              ["code", "Booking code"],
              ["depositAmount", "PayNow deposit (SGD)"]
            ].map(([key, label]) => (
              <label key={key} className="admin-field">
                <span className="admin-field-label">{label}</span>
                <input
                  type="text"
                  value={String(form[key] ?? "")}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="admin-input"
                />
              </label>
            ))}

            <label className="admin-field">
              <span className="admin-field-label">Curriculum (one item per line)</span>
              <textarea rows={3} value={String(form.curriculumItems ?? "")} onChange={(e) => setForm({ ...form, curriculumItems: e.target.value })} className="admin-textarea" />
            </label>

            <label className="admin-field">
              <span className="admin-field-label">Sort order</span>
              <input type="number" value={String(form.sortOrder ?? 0)} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} className="admin-input" />
            </label>

            {[
              ["usePayNow", "Use PayNow flow"],
              ["singlePerson", "Single person booking"],
              ["published", "Published on website"]
            ].map(([key, label]) => (
              <label key={key} className="admin-field-checkbox">
                <input type="checkbox" checked={Boolean(form[key])} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
                {label}
              </label>
            ))}

            <div className="admin-form-actions">
              <button type="submit" className="admin-btn admin-btn-primary">Save</button>
              {editingId && (
                <button type="button" onClick={() => { setEditingId(null); setForm(emptyProgram()); }} className="admin-btn">Cancel</button>
              )}
            </div>
          </form>
        </div>
      </div>
    </AdminShell>
  );
}
