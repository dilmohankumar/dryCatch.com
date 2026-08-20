import { toDateKey, STORE_TIMEZONE_OFFSET_MINUTES } from "./businessDate.js";

// Central date-range parsing (rule #6/#97) — every analytics endpoint goes
// through this, so "last 30 days" means the same thing everywhere instead
// of each controller reinventing its own off-by-one.
const PRESETS = new Set([
  "today", "yesterday", "last7days", "last30days", "last90days",
  "thisMonth", "lastMonth", "thisYear", "custom",
]);

function startOfLocalDay(offsetMinutes) {
  const now = new Date(Date.now() + offsetMinutes * 60 * 1000);
  now.setUTCHours(0, 0, 0, 0);
  return new Date(now.getTime() - offsetMinutes * 60 * 1000);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// Returns { startDate, endDate, previousStartDate, previousEndDate, granularity }
// as actual Date objects (UTC instants) — callers convert to dateKey as needed.
export function resolveDateRange({ period = "last30days", startDate, endDate, granularity } = {}, offsetMinutes = STORE_TIMEZONE_OFFSET_MINUTES) {
  if (period !== "custom" && !PRESETS.has(period)) {
    throw Object.assign(new Error(`Unknown period "${period}"`), { statusCode: 400, code: "INVALID_PERIOD" });
  }

  const todayStart = startOfLocalDay(offsetMinutes);
  let start, end;

  switch (period) {
    case "today":
      start = todayStart;
      end = addDays(todayStart, 1);
      break;
    case "yesterday":
      start = addDays(todayStart, -1);
      end = todayStart;
      break;
    case "last7days":
      start = addDays(todayStart, -7);
      end = addDays(todayStart, 1);
      break;
    case "last30days":
      start = addDays(todayStart, -30);
      end = addDays(todayStart, 1);
      break;
    case "last90days":
      start = addDays(todayStart, -90);
      end = addDays(todayStart, 1);
      break;
    case "thisMonth": {
      const d = new Date(todayStart);
      const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      start = addDays(first, 0);
      end = addDays(todayStart, 1);
      break;
    }
    case "lastMonth": {
      const d = new Date(todayStart);
      const firstThisMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      const firstLastMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
      start = firstLastMonth;
      end = firstThisMonth;
      break;
    }
    case "thisYear": {
      const d = new Date(todayStart);
      start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      end = addDays(todayStart, 1);
      break;
    }
    case "custom": {
      if (!startDate || !endDate) fail("startDate and endDate are required for a custom period");
      start = new Date(startDate);
      end = addDays(new Date(endDate), 1); // endDate is inclusive
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) fail("Invalid startDate/endDate");
      break;
    }
    default:
      fail(`Unhandled period "${period}"`);
  }

  const MAX_RANGE_DAYS = 366; // rule #130 — bound the maximum date range a query can request
  if ((end - start) / (24 * 60 * 60 * 1000) > MAX_RANGE_DAYS) {
    fail(`Date range cannot exceed ${MAX_RANGE_DAYS} days`, "RANGE_TOO_LARGE");
  }
  if (end <= start) fail("endDate must be after startDate");

  const durationMs = end - start;
  const previousEndDate = new Date(start);
  const previousStartDate = new Date(start.getTime() - durationMs);

  return {
    startDate: start,
    endDate: end,
    previousStartDate,
    previousEndDate,
    granularity: granularity || (durationMs > 90 * 24 * 60 * 60 * 1000 ? "month" : durationMs > 14 * 24 * 60 * 60 * 1000 ? "week" : "day"),
    timezoneOffsetMinutes: offsetMinutes,
  };
}

function fail(message, code = "INVALID_DATE_RANGE") {
  throw Object.assign(new Error(message), { statusCode: 400, code });
}

export function dateKeysBetween(startDate, endDate, offsetMinutes = STORE_TIMEZONE_OFFSET_MINUTES) {
  const keys = [];
  let cursor = new Date(startDate);
  while (cursor < endDate) {
    keys.push(toDateKey(cursor, offsetMinutes));
    cursor = addDays(cursor, 1);
  }
  return keys;
}
