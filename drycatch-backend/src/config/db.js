import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

const SLOW_QUERY_THRESHOLD_MS = Number(process.env.SLOW_QUERY_THRESHOLD_MS) || 200;

// Phase 22 — database observability (rule #21). Patches `Query.prototype.exec`
// once, at the shared-prototype level — this covers every `find`/
// `findOne`/`updateOne`/etc. across every model regardless of import
// order (mongoose's per-schema `pre`/`post` hooks would need to be
// registered before each model's schema compiles, which is too late by
// the time this file runs — most models are already imported via the
// route/controller/service chain before `connectDB()` is ever called).
// Only logs queries slower than the threshold — logging every query at
// full volume would be exactly the "uncontrolled observability cost"
// rule #64 warns against; fast queries aren't what needs investigating.
const originalExec = mongoose.Query.prototype.exec;
mongoose.Query.prototype.exec = function patchedExec(...args) {
  const start = process.hrtime.bigint();
  const collection = this.mongooseCollection?.name;
  const op = this.op;
  return originalExec.apply(this, args).then(
    (result) => {
      logSlowQuery(collection, op, start);
      return result;
    },
    (err) => {
      logSlowQuery(collection, op, start);
      throw err;
    }
  );
};

function logSlowQuery(collection, op, startNs) {
  const durationMs = Number(process.hrtime.bigint() - startNs) / 1e6;
  if (durationMs >= SLOW_QUERY_THRESHOLD_MS) {
    logger.warn("Slow database query", { collection, operation: op, durationMs: Math.round(durationMs) });
  }
}

// Aggregation pipelines (Phase 17's analytics category rollups, top-products,
// cohort matrix, etc.) go through Aggregate#exec, not Query#exec — patched
// separately since it's genuinely the same class of expensive operation
// this is meant to catch.
const originalAggregateExec = mongoose.Aggregate.prototype.exec;
mongoose.Aggregate.prototype.exec = function patchedAggregateExec(...args) {
  const start = process.hrtime.bigint();
  const collection = this._model?.collection?.name;
  return originalAggregateExec.apply(this, args).then(
    (result) => {
      logSlowQuery(collection, "aggregate", start);
      return result;
    },
    (err) => {
      logSlowQuery(collection, "aggregate", start);
      throw err;
    }
  );
};

export async function connectDB() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB connected");
}
