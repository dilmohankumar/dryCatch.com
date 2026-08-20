// All timestamps stay UTC in the database (rule #8/#117) — this is the one
// place "what business day did this happen on" gets decided, so it's never
// reinvented per-aggregate-updater. STORE_TIMEZONE is a fixed offset for
// this single-store deployment (documented single-tenant scope, same as
// every earlier phase) rather than per-tenant/per-user timezone resolution
// — a real multi-tenant rollout would look this up per store instead of a
// single env var.
const STORE_TIMEZONE_OFFSET_MINUTES = Number(process.env.STORE_TIMEZONE_OFFSET_MINUTES ?? 330); // default IST (UTC+5:30)

export function toDateKey(date, offsetMinutes = STORE_TIMEZONE_OFFSET_MINUTES) {
  const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  return shifted.toISOString().slice(0, 10); // "YYYY-MM-DD" in store-local time
}

export function dateKeyToUtcRange(dateKey, offsetMinutes = STORE_TIMEZONE_OFFSET_MINUTES) {
  const startLocal = new Date(`${dateKey}T00:00:00.000Z`);
  const start = new Date(startLocal.getTime() - offsetMinutes * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function todayDateKey(offsetMinutes = STORE_TIMEZONE_OFFSET_MINUTES) {
  return toDateKey(new Date(), offsetMinutes);
}

export { STORE_TIMEZONE_OFFSET_MINUTES };
