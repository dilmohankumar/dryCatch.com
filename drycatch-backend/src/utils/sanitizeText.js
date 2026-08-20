// Review title/body are plain text by design — this project renders them
// as text, never as HTML, so the correct defense is stripping markup
// entirely rather than trying to allow-list a safe HTML subset (rule #6/
// #50: "do not render raw user HTML"). No templating library is pulled in
// for this — a strip-all-tags pass is the whole job when the output is
// never interpreted as HTML.
export function sanitizePlainText(input) {
  if (typeof input !== "string") return input;
  return input
    .replace(/<[^>]*>/g, "") // strip any tag, including <script>, <img onerror=...>, etc.
    .replace(/javascript:/gi, "")
    .trim();
}
