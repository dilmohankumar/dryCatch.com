// Minimal required-field guard for admin write endpoints — no new dependency
// pulled in for this; a schema library (zod/joi) is worth adding once
// validation needs grow past simple required-field checks.
export function requireFields(fields) {
  return (req, res, next) => {
    const missing = fields.filter((f) => req.body[f] === undefined || req.body[f] === null || req.body[f] === "");
    if (missing.length) {
      return res.status(400).json({ message: `Missing required field(s): ${missing.join(", ")}` });
    }
    next();
  };
}
