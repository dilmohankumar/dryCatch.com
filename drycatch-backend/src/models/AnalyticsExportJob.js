import mongoose from "mongoose";

// Async export lifecycle (rule #81). No real job queue exists in this
// project (Phase 16's honest-scope note applies here too) — the job is
// still processed in-process immediately after creation, but modeled with
// the same pending/processing/completed/failed states a real queue-backed
// worker would use, so swapping in a real queue later only touches
// exportService.js, never a caller.
const analyticsExportJobSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // e.g. "sales", "products", "customers"
    format: { type: String, enum: ["csv"], default: "csv" }, // Excel/PDF not implemented (rule #145: "only if required") — documented gap
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["pending", "processing", "completed", "failed"], default: "pending", index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rowCount: Number,
    fileContent: String, // small-to-medium CSV kept inline (no object storage exists — same honest-stub gap as CMS media); large exports would need real storage
    error: String,
    expiresAt: { type: Date, required: true, index: true }, // short-lived download window (rule #82)
    downloadToken: { type: String, required: true, unique: true }, // unguessable, checked instead of trusting the job id alone
  },
  { timestamps: true }
);

export default mongoose.model("AnalyticsExportJob", analyticsExportJobSchema);
