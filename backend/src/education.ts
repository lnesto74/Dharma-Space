/** Education program categories shown on the public site. */
import { isProgramFinished, programScheduleStatus, sortProgramsForDisplay } from "./program-schedule.js";

export const PROGRAM_CATEGORIES = ["FLAGSHIP", "CERTIFICATION", "WORKSHOP", "EVENT"] as const;
export type ProgramCategory = (typeof PROGRAM_CATEGORIES)[number];

/** Maps legacy seed values to current category names. */
export const LEGACY_CATEGORY_MAP: Record<string, ProgramCategory> = {
  YTT: "FLAGSHIP",
  COURSE: "CERTIFICATION",
  WORKSHOP: "WORKSHOP",
  EVENT: "EVENT",
  FLAGSHIP: "FLAGSHIP",
  CERTIFICATION: "CERTIFICATION"
};

export function normalizeProgramCategory(category: string): ProgramCategory {
  return LEGACY_CATEGORY_MAP[category.toUpperCase()] || "CERTIFICATION";
}

export function categoryMatches(programCategory: string, target: ProgramCategory): boolean {
  return normalizeProgramCategory(programCategory) === target;
}

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function serializeProgram(program: any) {
  const normalized = {
    ...program,
    category: normalizeProgramCategory(program.category),
    comingSoon: Boolean(program.comingSoon),
    scheduledDate: program.scheduledDate || "",
    startMinutes: program.startMinutes || 0,
    curriculumItems: parseJsonArray(program.curriculumItems)
  };
  const finished = isProgramFinished(normalized);
  return {
    ...normalized,
    finished,
    status: programScheduleStatus(normalized)
  };
}

export function groupProgramsByCategory(programs: any[]) {
  const normalized = programs.map(serializeProgram);
  const sortList = (items: typeof normalized) => sortProgramsForDisplay(items);
  return {
    flagship: sortList(normalized.filter((p) => p.category === "FLAGSHIP")),
    certifications: sortList(normalized.filter((p) => p.category === "CERTIFICATION")),
    workshops: sortList(normalized.filter((p) => p.category === "WORKSHOP")),
    events: sortList(normalized.filter((p) => p.category === "EVENT")),
    // Legacy keys for gradual frontend migration
    ytt: sortList(normalized.filter((p) => p.category === "FLAGSHIP")),
    courses: sortList(normalized.filter((p) => p.category === "CERTIFICATION"))
  };
}
