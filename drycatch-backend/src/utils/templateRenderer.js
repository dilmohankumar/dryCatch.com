// Deliberately NOT a real template engine (no eval, no Function()
// construction, no server-side includes) — rule #37/#154: template
// injection must be structurally impossible, not just filtered. Supports
// exactly one thing: {{variableName}} substitution, HTML-escaped by
// default so a variable value can never inject markup/script into an
// email body (rule #37 "unsafe HTML").
const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function extractVariables(body) {
  const found = new Set();
  let match;
  const re = new RegExp(PLACEHOLDER);
  while ((match = re.exec(body || ""))) found.add(match[1]);
  return [...found];
}

// Throws if the template references a variable the event payload/context
// doesn't provide (rule #142) — caught at publish-time in templateService,
// not discovered as a blank spot in a sent email.
export function validateVariables(body, availableVars) {
  const used = extractVariables(body);
  const available = new Set(availableVars);
  const missing = used.filter((v) => !available.has(v));
  if (missing.length) {
    throw Object.assign(new Error(`Template references undeclared variable(s): ${missing.join(", ")}`), {
      statusCode: 422,
      code: "TEMPLATE_VARIABLE_MISSING",
      missing,
    });
  }
}

export function renderTemplate(body, context = {}, { escape = true } = {}) {
  return String(body || "").replace(PLACEHOLDER, (_, key) => {
    const value = context[key];
    if (value === undefined || value === null) return "";
    return escape ? escapeHtml(value) : String(value);
  });
}
