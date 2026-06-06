import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ClassSchedulePresets = {
  classTypes: string[];
  locations: string[];
};

const PRESETS_PATH = path.join(process.cwd(), "data", "class-schedule-presets.json");

const DEFAULT_PRESETS: ClassSchedulePresets = {
  classTypes: ["Hatha Yoga", "Vinyasa Flow", "Pilates", "Meditation"],
  locations: ["Dharma"]
};

function normalizeList(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(value);
  }
  return next;
}

function mergePresets(input: Partial<ClassSchedulePresets>): ClassSchedulePresets {
  return {
    classTypes: normalizeList(input.classTypes?.length ? input.classTypes : DEFAULT_PRESETS.classTypes),
    locations: normalizeList(input.locations?.length ? input.locations : DEFAULT_PRESETS.locations)
  };
}

async function ensurePresetsFile() {
  await mkdir(path.dirname(PRESETS_PATH), { recursive: true });
  try {
    await access(PRESETS_PATH);
  } catch {
    await writeFile(PRESETS_PATH, `${JSON.stringify(DEFAULT_PRESETS, null, 2)}\n`, "utf8");
  }
}

export async function readClassSchedulePresets(): Promise<ClassSchedulePresets> {
  await ensurePresetsFile();
  const raw = await readFile(PRESETS_PATH, "utf8");
  try {
    return mergePresets(JSON.parse(raw) as Partial<ClassSchedulePresets>);
  } catch {
    return { ...DEFAULT_PRESETS };
  }
}

export async function addClassSchedulePreset(kind: "classType" | "location", value: string): Promise<ClassSchedulePresets> {
  const trimmed = value.trim();
  if (!trimmed) return readClassSchedulePresets();

  const presets = await readClassSchedulePresets();
  const key = kind === "classType" ? "classTypes" : "locations";
  const next = mergePresets({
    ...presets,
    [key]: [...presets[key], trimmed]
  });

  await writeFile(PRESETS_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}
