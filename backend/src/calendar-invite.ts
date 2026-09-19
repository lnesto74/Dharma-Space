/**
 * Calendar invites for confirmed bookings.
 *
 * Emits a plain iCalendar (.ics) file with METHOD:PUBLISH — an "add this to my
 * calendar" attachment rather than a meeting request, so it opens the same way
 * in Apple Calendar, Google Calendar and Outlook without any of them treating
 * the studio as a meeting organiser awaiting an RSVP.
 *
 * Times are written in UTC. Singapore has been UTC+8 with no daylight saving
 * since 1982, so converting is a fixed subtraction and no VTIMEZONE block is
 * needed for the times to land correctly in any client, anywhere.
 */

const SGT_OFFSET_MINUTES = 8 * 60;

export const STUDIO_ADDRESS = "13 Upper Circular Road #03-01, Singapore 058411";

export type CalendarEvent = {
  /** Stable per booking, so re-sending updates the entry instead of duplicating it. */
  uid: string;
  title: string;
  description: string;
  location: string;
  start: Date;
  durationMinutes: number;
  organizerName: string;
  organizerEmail: string;
};

/**
 * Turns a Singapore wall-clock date and time into the absolute instant it
 * refers to. Returns null when the date isn't a usable YYYY-MM-DD.
 */
export function singaporeInstant(dateIso: string, minutesFromMidnight: number): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const utcMidnight = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const instant = new Date(utcMidnight + (minutesFromMidnight - SGT_OFFSET_MINUTES) * 60_000);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Commas, semicolons and backslashes are field separators in iCalendar. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** iCalendar lines cap at 75 octets; continuations start with a single space. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest) parts.push(` ${rest}`);
  return parts.join("\r\n");
}

export function buildIcs(event: CalendarEvent): string {
  const end = new Date(event.start.getTime() + event.durationMinutes * 60_000);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dharma Space//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(event.start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `LOCATION:${escapeText(event.location)}`,
    `ORGANIZER;CN=${escapeText(event.organizerName)}:mailto:${event.organizerEmail}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    // A nudge an hour before, which is about the time it takes to get across town.
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(event.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ];

  return lines.map(fold).join("\r\n");
}

/** A filename that reads sensibly in a downloads folder. */
export function icsFilename(reference: string): string {
  return `dharma-space-${reference.toLowerCase()}.ics`;
}
