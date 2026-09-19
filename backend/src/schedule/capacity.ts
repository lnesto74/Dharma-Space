/**
 * How many people fit in a class.
 *
 * Capacity is not purely a property of the room. Aerial is limited by the
 * number of hammocks rather than floor space, and meditation and sound healing
 * seat more people than the room's mat count because nobody needs a mat. So a
 * class-type limit, where one exists, wins over the room default.
 */

/** Mat-based capacity, used when the class type has no limit of its own. */
const ROOM_CAPACITY: Record<string, number> = {
  "Room 1": 15,
  "Room 2": 10
};

/** Limits that travel with the class type, whichever room it runs in. */
const CATEGORY_CAPACITY: Record<string, number> = {
  AERIAL: 11,
  MEDITATION: 15,
  SOUND: 15
};

export const DEFAULT_ROOM_CAPACITY = 15;

export function defaultCapacityFor(input: {
  category?: string | null;
  location?: string | null;
  entryType?: string | null;
}): number {
  // Teacher training and workshop windows aren't booked by the seat.
  if (input.entryType && input.entryType !== "CLASS") return 0;

  const byCategory = input.category ? CATEGORY_CAPACITY[input.category] : undefined;
  if (byCategory != null) return byCategory;

  const room = (input.location ?? "").trim();
  return ROOM_CAPACITY[room] ?? DEFAULT_ROOM_CAPACITY;
}
