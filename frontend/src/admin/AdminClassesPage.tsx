import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, GripVertical, LayoutGrid, List, Plus, RefreshCw, Type } from "lucide-react";
import { AdminShell } from "./SiteAdminPages";
import { adminApi } from "./adminApi";
import { isValidStripeLink, STRIPE_LINK_HINT } from "../lib/program-form";
import {
  CALENDAR_END_MINUTES,
  CALENDAR_START_MINUTES,
  DEFAULT_DURATION_MINUTES,
  SLOT_MINUTES,
  WEEKDAYS,
  addDays,
  classDateFromDayIndex,
  dayIndexFromClassDate,
  formatClassDateLabel,
  formatMinutesToTime,
  indexToDay,
  isDateInWeek,
  isoDateLocal,
  startOfWeekMonday
} from "../lib/class-schedule";

const SLOT_HEIGHT = 28;

type Auth = { token: string; user: { name: string; role: string } | null };

type ClassPresets = { classTypes: string[]; locations: string[] };

type TrainerOption = { id: string; name: string };

export type SiteClassRow = {
  id: string;
  classDate: string;
  day: string;
  dayIndex: number;
  time: string;
  startMinutes: number;
  durationMinutes: number;
  classType: string;
  instructor: string;
  level: string;
  location: string;
  price: string;
  stripeLink?: string | null;
  published: boolean;
  comingSoon: boolean;
  sortOrder: number;
};

function livePill(published: boolean) {
  return published
    ? <span className="admin-pill admin-pill-green"><span className="admin-pill-dot" />Live</span>
    : <span className="admin-pill admin-pill-gray"><span className="admin-pill-dot" />Draft</span>;
}

function emptyClass(weekStart: Date, dayIndex = 0, startMinutes = 7 * 60): Partial<SiteClassRow> {
  const classDate = classDateFromDayIndex(weekStart, dayIndex);
  return {
    classDate,
    day: indexToDay(dayIndex),
    dayIndex,
    time: formatMinutesToTime(startMinutes),
    startMinutes,
    durationMinutes: DEFAULT_DURATION_MINUTES,
    classType: "",
    instructor: "",
    level: "All Levels",
    location: "Dharma",
    price: "SGD 35",
    stripeLink: "",
    published: true,
    comingSoon: false,
    sortOrder: 0
  };
}

function slotCount() {
  return (CALENDAR_END_MINUTES - CALENDAR_START_MINUTES) / SLOT_MINUTES;
}

function minutesToTop(minutes: number) {
  return ((minutes - CALENDAR_START_MINUTES) / SLOT_MINUTES) * SLOT_HEIGHT;
}

function durationToHeight(durationMinutes: number) {
  return (durationMinutes / SLOT_MINUTES) * SLOT_HEIGHT - 2;
}

function minutesToInputTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function PresetField({
  label,
  value,
  presets,
  onChange,
  onAddPreset,
  defaultUsePreset = true
}: {
  label: string;
  value: string;
  presets: string[];
  onChange: (value: string) => void;
  onAddPreset: (value: string) => Promise<void>;
  defaultUsePreset?: boolean;
}) {
  const [usePreset, setUsePreset] = useState(defaultUsePreset && presets.includes(value));
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (value && presets.includes(value)) setUsePreset(true);
  }, [presets, value]);

  const addCurrent = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      await onAddPreset(trimmed);
      setUsePreset(true);
    } finally {
      setAdding(false);
    }
  };

  return (
    <label className="admin-field">
      <span className="admin-field-label">{label}</span>
      <div className="admin-preset-row">
        <button
          type="button"
          className="admin-preset-toggle"
          title={usePreset ? "Type manually" : "Pick from saved list"}
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
        <button type="button" className="admin-preset-add" title="Save to list" disabled={adding || !value.trim()} onClick={addCurrent}>
          +
        </button>
      </div>
    </label>
  );
}

export function AdminSiteClassesPage({ auth }: { auth: Auth }) {
  const [view, setView] = useState<"calendar" | "table">("calendar");
  const [items, setItems] = useState<SiteClassRow[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [form, setForm] = useState<Partial<SiteClassRow>>(() => emptyClass(startOfWeekMonday(new Date())));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [savingMove, setSavingMove] = useState(false);
  const [presets, setPresets] = useState<ClassPresets>({ classTypes: [], locations: ["Dharma"] });
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    adminApi<{ classes: SiteClassRow[] }>("/api/admin/site/classes", auth.token)
      .then((d) => setItems(d.classes))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [auth.token]);

  const loadPresets = useCallback(() => {
    adminApi<ClassPresets>("/api/admin/site/classes/presets", auth.token)
      .then(setPresets)
      .catch(() => {});
  }, [auth.token]);

  const loadTrainers = useCallback(() => {
    adminApi<{ trainers: TrainerOption[] }>("/api/admin/site/trainers", auth.token)
      .then((d) => setTrainers(d.trainers.map((t) => ({ id: t.id, name: t.name }))))
      .catch(() => {});
  }, [auth.token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadPresets(); loadTrainers(); }, [loadPresets, loadTrainers]);

  const slots = useMemo(() => {
    return Array.from({ length: slotCount() }, (_, i) => CALENDAR_START_MINUTES + i * SLOT_MINUTES);
  }, []);

  const weekEndLabel = useMemo(() => formatClassDateLabel(isoDateLocal(addDays(weekStart, 6))), [weekStart]);
  const weekStartLabel = useMemo(() => formatClassDateLabel(isoDateLocal(weekStart)), [weekStart]);

  const visibleItems = useMemo(() => {
    return items.filter((item) => !item.classDate || isDateInWeek(item.classDate, weekStart));
  }, [items, weekStart]);

  const classesByDay = useMemo(() => {
    const map: Record<number, SiteClassRow[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const item of visibleItems) map[item.dayIndex]?.push(item);
    return map;
  }, [visibleItems]);

  const startEdit = (item: SiteClassRow) => {
    setEditingId(item.id);
    setForm({ ...item });
    if (item.classDate) {
      setWeekStart(startOfWeekMonday(new Date(`${item.classDate}T12:00:00`)));
    }
    setError("");
  };

  const openNewAt = (dayIndex: number, startMinutes: number) => {
    setEditingId(null);
    setForm(emptyClass(weekStart, dayIndex, startMinutes));
    setError("");
  };

  const addPreset = async (kind: "classType" | "location", value: string) => {
    const next = await adminApi<ClassPresets>("/api/admin/site/classes/presets", auth.token, {
      method: "POST",
      body: JSON.stringify({ kind, value })
    });
    setPresets(next);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const comingSoon = Boolean(form.comingSoon);
    const stripeLink = String(form.stripeLink ?? "").trim();
    if (!comingSoon && (!stripeLink || !isValidStripeLink(stripeLink))) {
      setError("Stripe booking link is required when the class is scheduled.");
      return;
    }
    if (comingSoon && stripeLink) {
      setError("Remove the Stripe link — coming soon classes use Reserve Spot, not Stripe checkout.");
      return;
    }
    try {
      const payload = { ...form, stripeLink: comingSoon ? null : stripeLink || null };
      if (editingId) {
        const res = await adminApi<{ class: SiteClassRow }>(`/api/admin/site/classes/${editingId}`, auth.token, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        setForm(res.class);
        setEditingId(res.class.id);
      } else {
        const res = await adminApi<{ class: SiteClassRow }>("/api/admin/site/classes", auth.token, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setEditingId(res.class.id);
        setForm(res.class);
      }
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this class?")) return;
    await adminApi(`/api/admin/site/classes/${id}`, auth.token, { method: "DELETE" });
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyClass(weekStart));
    }
    load();
  };

  const moveClass = async (id: string, dayIndex: number, startMinutes: number) => {
    setSavingMove(true);
    setError("");
    const classDate = classDateFromDayIndex(weekStart, dayIndex);
    try {
      const res = await adminApi<{ class: SiteClassRow }>(`/api/admin/site/classes/${id}/move`, auth.token, {
        method: "PATCH",
        body: JSON.stringify({ dayIndex, startMinutes, classDate })
      });
      setItems((prev) => prev.map((c) => (c.id === id ? res.class : c)));
      if (editingId === id) setForm(res.class);
    } catch (err: any) {
      setError(err.message);
      load();
    } finally {
      setSavingMove(false);
      setDraggingId(null);
    }
  };

  const handleDropOnSlot = (dayIndex: number, startMinutes: number) => {
    if (draggingId) {
      moveClass(draggingId, dayIndex, startMinutes);
      return;
    }
    openNewAt(dayIndex, startMinutes);
  };

  const setClassDate = (classDate: string) => {
    const dayIndex = dayIndexFromClassDate(classDate);
    setForm({
      ...form,
      classDate,
      dayIndex,
      day: indexToDay(dayIndex)
    });
    setWeekStart(startOfWeekMonday(new Date(`${classDate}T12:00:00`)));
  };

  const toolbar = (
    <div className="admin-view-tabs">
      <button type="button" className={`admin-view-tab${view === "calendar" ? " active" : ""}`} onClick={() => setView("calendar")}>
        <CalendarDays style={{ width: 14, height: 14 }} /> Calendar
      </button>
      <button type="button" className={`admin-view-tab${view === "table" ? " active" : ""}`} onClick={() => setView("table")}>
        <LayoutGrid style={{ width: 14, height: 14 }} /> Table
      </button>
    </div>
  );

  const formPanel = (
    <div className="admin-panel">
      <h2 className="admin-panel-title">{editingId ? "Edit class" : "New class"}</h2>
      <p className="admin-import-hint" style={{ marginTop: -8, marginBottom: 12 }}>
        One-time classes — pick a date, time, and duration. Drag on the calendar to reschedule.
      </p>
      <form onSubmit={save}>
        <label className="admin-field">
          <span className="admin-field-label">Date</span>
          <input
            type="date"
            value={form.classDate ?? ""}
            onChange={(e) => setClassDate(e.target.value)}
            className="admin-input"
            required
          />
        </label>
        <label className="admin-field">
          <span className="admin-field-label">Start time</span>
          <input
            type="time"
            value={minutesToInputTime(form.startMinutes ?? 420)}
            onChange={(e) => {
              const [h, m] = e.target.value.split(":").map(Number);
              const startMinutes = h * 60 + m;
              setForm({ ...form, startMinutes, time: formatMinutesToTime(startMinutes) });
            }}
            className="admin-input"
            step={1800}
          />
        </label>
        <label className="admin-field">
          <span className="admin-field-label">Duration (minutes)</span>
          <select
            value={form.durationMinutes ?? DEFAULT_DURATION_MINUTES}
            onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
            className="admin-input"
          >
            {[30, 45, 60, 75, 90, 120].map((n) => <option key={n} value={n}>{n} min</option>)}
          </select>
        </label>

        <PresetField
          label="Class type"
          value={form.classType ?? ""}
          presets={presets.classTypes}
          onChange={(classType) => setForm({ ...form, classType })}
          onAddPreset={(value) => addPreset("classType", value)}
        />

        <label className="admin-field">
          <span className="admin-field-label">Instructor</span>
          <select
            value={form.instructor ?? ""}
            onChange={(e) => setForm({ ...form, instructor: e.target.value })}
            className="admin-input"
            required
          >
            <option value="">Select trainer…</option>
            {trainers.map((trainer) => <option key={trainer.id} value={trainer.name}>{trainer.name}</option>)}
            {form.instructor && !trainers.some((t) => t.name === form.instructor) ? (
              <option value={form.instructor}>{form.instructor}</option>
            ) : null}
          </select>
        </label>

        <label className="admin-field">
          <span className="admin-field-label">Level</span>
          <input
            type="text"
            value={form.level ?? ""}
            onChange={(e) => setForm({ ...form, level: e.target.value })}
            className="admin-input"
          />
        </label>

        <PresetField
          label="Location"
          value={form.location ?? "Dharma"}
          presets={presets.locations}
          onChange={(location) => setForm({ ...form, location })}
          onAddPreset={(value) => addPreset("location", value)}
          defaultUsePreset
        />

        {[
          ["price", "Price"]
        ].map(([key, label]) => (
          <label key={key} className="admin-field">
            <span className="admin-field-label">{label}</span>
            <input
              type="text"
              value={String((form as any)[key] ?? "")}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="admin-input"
            />
          </label>
        ))}

        {!form.comingSoon && (
          <label className="admin-field">
            <span className="admin-field-label">Stripe booking link *</span>
            <input
              type="url"
              value={String(form.stripeLink ?? "")}
              onChange={(e) => setForm({ ...form, stripeLink: e.target.value })}
              className="admin-input"
              placeholder="https://buy.stripe.com/..."
              required
            />
            <span className="admin-field-hint">{STRIPE_LINK_HINT}</span>
          </label>
        )}
        {form.comingSoon && (
          <p className="admin-field-hint" style={{ marginBottom: 12 }}>
            Coming soon — no Stripe link. Visitors use Reserve Spot; enquiries go to your inbox and vera@dharma-space.com.
          </p>
        )}

        <label className="admin-field-checkbox">
          <input
            type="checkbox"
            checked={Boolean(form.comingSoon)}
            onChange={(e) => setForm({
              ...form,
              comingSoon: e.target.checked,
              stripeLink: e.target.checked ? "" : form.stripeLink
            })}
          />
          Show as coming soon
        </label>
        <label className="admin-field-checkbox">
          <input type="checkbox" checked={Boolean(form.published)} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
          Published on website
        </label>
        <div className="admin-form-actions">
          <button type="submit" className="admin-btn admin-btn-primary">Save</button>
          {editingId && (
            <>
              <button type="button" onClick={() => remove(editingId)} className="admin-btn admin-btn-danger">Delete</button>
              <button type="button" onClick={() => { setEditingId(null); setForm(emptyClass(weekStart)); }} className="admin-btn">Cancel</button>
            </>
          )}
        </div>
      </form>
    </div>
  );

  return (
    <AdminShell
      auth={auth}
      title="Regular Class Schedule"
      subtitle="Schedule one-time classes — pick dates, assign trainers, drag to reschedule."
      icon={CalendarDays}
      toolbar={toolbar}
    >
      {error && <div className="admin-alert">{error}</div>}
      {savingMove && <div className="admin-alert admin-alert-warn">Saving new time…</div>}

      <div className={`admin-layout-split${view === "calendar" ? " admin-layout-calendar" : ""}`}>
        <div className="admin-layout-main">
          <div className="admin-db-toolbar">
            {view === "calendar" ? (
              <div className="admin-calendar-week-nav">
                <button type="button" className="admin-btn" onClick={() => setWeekStart((prev) => addDays(prev, -7))} aria-label="Previous week">
                  <ChevronLeft size={14} />
                </button>
                <span className="admin-calendar-week-label">{weekStartLabel} – {weekEndLabel}</span>
                <button type="button" className="admin-btn" onClick={() => setWeekStart((prev) => addDays(prev, 7))} aria-label="Next week">
                  <ChevronRight size={14} />
                </button>
                <button type="button" className="admin-btn" onClick={() => setWeekStart(startOfWeekMonday(new Date()))}>Today</button>
              </div>
            ) : (
              <span style={{ fontSize: 13, color: "var(--admin-text-tertiary)" }}>All classes</span>
            )}
            <div className="admin-db-toolbar-spacer" />
            <button type="button" onClick={load} className="admin-btn"><RefreshCw style={{ width: 14, height: 14 }} /> Refresh</button>
            <button type="button" onClick={() => openNewAt(0, 7 * 60)} className="admin-btn admin-btn-primary">
              <Plus style={{ width: 14, height: 14 }} /> New class
            </button>
          </div>

          {loading ? (
            <div className="admin-loading">Loading…</div>
          ) : view === "table" ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Date</th><th>Time</th><th>Class</th><th>Instructor</th><th>Location</th><th>Duration</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className={editingId === item.id ? "admin-row-selected" : undefined} onClick={() => startEdit(item)}>
                      <td className="admin-td-name">{item.classDate ? formatClassDateLabel(item.classDate) : item.day}</td>
                      <td>{item.time}</td>
                      <td>{item.classType}</td>
                      <td>{item.instructor}</td>
                      <td>{item.location}</td>
                      <td>{item.durationMinutes}m</td>
                      <td>{livePill(item.published)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => remove(item.id)} className="admin-btn admin-btn-danger">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {!items.length && <tr className="admin-table-empty"><td colSpan={8}>No classes yet.</td></tr>}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-calendar-wrap">
              <div className="admin-calendar-header">
                <div className="admin-calendar-corner" />
                {WEEKDAYS.map((day, dayIndex) => (
                  <div key={day} className="admin-calendar-day-head">
                    {day.slice(0, 3)}
                    <span className="admin-calendar-day-date">{formatClassDateLabel(classDateFromDayIndex(weekStart, dayIndex))}</span>
                  </div>
                ))}
              </div>
              <div className="admin-calendar-body">
                <div className="admin-calendar-time-col">
                  {slots.map((minutes) => (
                    <div key={minutes} className="admin-calendar-time-label" style={{ height: SLOT_HEIGHT }}>
                      {minutes % 60 === 0 ? formatMinutesToTime(minutes).replace(":00", "") : ""}
                    </div>
                  ))}
                </div>
                <div className="admin-calendar-days">
                  {WEEKDAYS.map((day, dayIndex) => (
                    <div key={day} className="admin-calendar-day-col" style={{ height: slots.length * SLOT_HEIGHT }}>
                      {slots.map((startMinutes) => (
                        <div
                          key={`${dayIndex}-${startMinutes}`}
                          className="admin-calendar-slot"
                          style={{ height: SLOT_HEIGHT }}
                          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("drag-over"); }}
                          onDragLeave={(e) => e.currentTarget.classList.remove("drag-over")}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove("drag-over");
                            handleDropOnSlot(dayIndex, startMinutes);
                          }}
                          onDoubleClick={() => openNewAt(dayIndex, startMinutes)}
                        />
                      ))}

                      {classesByDay[dayIndex]?.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            setDraggingId(item.id);
                            e.dataTransfer.setData("text/plain", item.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => setDraggingId(null)}
                          onClick={() => startEdit(item)}
                          className={`admin-calendar-event${editingId === item.id ? " selected" : ""}${draggingId === item.id ? " dragging" : ""}${!item.published ? " draft" : ""}`}
                          style={{
                            top: minutesToTop(item.startMinutes),
                            height: durationToHeight(item.durationMinutes)
                          }}
                          title={`${item.classType} · ${item.instructor}`}
                        >
                          <GripVertical className="admin-calendar-event-grip" size={12} />
                          <span className="admin-calendar-event-time">{item.time}</span>
                          <span className="admin-calendar-event-title">{item.classType}</span>
                          <span className="admin-calendar-event-meta">{item.instructor}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        {formPanel}
      </div>
    </AdminShell>
  );
}
