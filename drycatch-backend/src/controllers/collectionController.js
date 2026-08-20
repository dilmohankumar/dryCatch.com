import Collection from "../models/Collection.js";
import * as collectionService from "../services/collectionService.js";
import { logAuditEvent } from "../utils/auditLog.js";

// GET /collections — public: active only
export async function getCollections(req, res) {
  const collections = await Collection.find({ status: "active" }).sort({ sortOrder: 1, name: 1 });
  res.json({ collections });
}

// GET /collections/:slug
export async function getCollectionBySlug(req, res) {
  const collection = await Collection.findOne({ slug: req.params.slug, status: "active" });
  if (!collection) return res.status(404).json({ message: "Collection not found" });
  res.json({ collection });
}

// POST /collections (admin)
export async function createCollection(req, res) {
  const collection = await collectionService.createCollection(req.body);
  logAuditEvent("COLLECTION_CREATED", req.user._id, { collectionId: collection._id, slug: collection.slug });
  res.status(201).json({ collection });
}

// PATCH /collections/:id (admin)
export async function updateCollection(req, res) {
  const collection = await collectionService.updateCollection(req.params.id, req.body);
  if (!collection) return res.status(404).json({ message: "Collection not found" });
  logAuditEvent("COLLECTION_UPDATED", req.user._id, { collectionId: collection._id });
  res.json({ collection });
}

// DELETE /collections/:id (admin)
export async function deleteCollection(req, res) {
  const collection = await collectionService.deleteCollection(req.params.id);
  if (!collection) return res.status(404).json({ message: "Collection not found" });
  logAuditEvent("COLLECTION_DELETED", req.user._id, { collectionId: req.params.id });
  res.json({ message: "Collection deleted" });
}
