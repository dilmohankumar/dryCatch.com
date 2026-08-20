import Category from "../models/Category.js";
import * as categoryService from "../services/categoryService.js";
import { logAuditEvent } from "../utils/auditLog.js";
import { resolveRedirect } from "../services/cms/redirectService.js";

// GET /categories — public: active only
export async function getCategories(req, res) {
  const categories = await Category.find({ status: "active" }).sort({ sortOrder: 1, name: 1 });
  res.json({ categories });
}

// GET /categories/tree
export async function getCategoryTree(req, res) {
  const tree = await categoryService.getCategoryTree();
  res.json({ tree });
}

// GET /categories/:idOrSlug — accepts a Mongo _id or a slug, also returns
// a real breadcrumb trail built from the parent chain.
export async function getCategoryById(req, res) {
  const isObjectId = /^[a-f0-9]{24}$/i.test(req.params.id);
  const category = isObjectId
    ? await Category.findOne({ _id: req.params.id, status: "active" })
    : await Category.findOne({ slug: req.params.id, status: "active" });
  if (!category) {
    const redirect = await resolveRedirect(`/category/${req.params.id}`);
    return res.status(404).json({ message: "Category not found", redirectTo: redirect?.destination });
  }

  const breadcrumb = await categoryService.getCategoryBreadcrumb(category);
  res.json({ category, breadcrumb });
}

// POST /categories (admin)
export async function createCategory(req, res) {
  const category = await categoryService.createCategory(req.body);
  logAuditEvent("CATEGORY_CREATED", req.user._id, { categoryId: category._id, slug: category.slug });
  res.status(201).json({ category });
}

// PUT /categories/:id (admin)
export async function updateCategory(req, res) {
  const category = await categoryService.updateCategory(req.params.id, req.body, req.user._id);
  if (!category) return res.status(404).json({ message: "Category not found" });
  logAuditEvent("CATEGORY_UPDATED", req.user._id, { categoryId: category._id });
  res.json({ category });
}

// DELETE /categories/:id (admin) — refuses if products/subcategories still
// reference it (see categoryService.deleteCategory).
export async function deleteCategory(req, res) {
  const category = await categoryService.deleteCategory(req.params.id);
  if (!category) return res.status(404).json({ message: "Category not found" });
  logAuditEvent("CATEGORY_DELETED", req.user._id, { categoryId: req.params.id });
  res.json({ message: "Category deleted" });
}
