// CSV generation with Excel-formula-injection guarding (rule #144). Any
// cell value starting with =, +, -, @, tab, or CR is prefixed with a
// single quote so spreadsheet software never interprets it as a formula —
// standard mitigation for CSV injection.
const DANGEROUS_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

function sanitizeCell(value) {
  if (value === null || value === undefined) return "";
  let str = String(value);
  if (DANGEROUS_PREFIXES.some((p) => str.startsWith(p))) str = `'${str}`;
  if (/[",\n\r]/.test(str)) str = `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function toCSV(rows, columns) {
  const header = columns.map((c) => sanitizeCell(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => sanitizeCell(typeof c.value === "function" ? c.value(row) : row[c.value])).join(","));
  return [header, ...lines].join("\r\n");
}
