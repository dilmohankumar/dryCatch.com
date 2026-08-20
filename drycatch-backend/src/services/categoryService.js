import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { generateUniqueSlug } from "../utils/slugify.js";
import * as redirectService from "./cms/redirectService.js";

const WRITABLE_FIELDS = ["name", "description", "image", "parent", "status", "sortOrder", "seo", "slug"];

function pickWritable(body) {
  const out = {};
  for (const field of WRITABLE_FIELDS) {
    if (body[field] !== undefined) out[field] = body[field];
  }
  return out;
}

export async function createCategory(body) {
  const data = pickWritable(body);
  if (!data.name) throw Object.assign(new Error("name is required"), { statusCode: 400 });

  data.slug = body.slug
    ? String(body.slug).toLowerCase().trim()
    : await generateUniqueSlug(data.name, (slug) => Category.exists({ slug }));

  const existing = await Category.exists({ slug: data.slug });
  if (existing) throw Object.assign(new Error("A category with this slug already exists"), { statusCode: 409 });

  return Category.create(data);
}

export async function updateCategory(id, body, actorId) {
  const category = await Category.findById(id);
  if (!category) return null;

  const data = pickWritable(body);
  if (String(data.parent) === String(id)) {
    throw Object.assign(new Error("A category cannot be its own parent"), { statusCode: 400 });
  }

  const previousSlug = category.slug;
  if (data.slug) {
    data.slug = String(data.slug).toLowerCase().trim();
    if (data.slug !== previousSlug) {
      const existing = await Category.exists({ slug: data.slug });
      if (existing) throw Object.assign(new Error("A category with this slug already exists"), { statusCode: 409 });
    }
  }

  Object.assign(category, data);
  await category.save();

  // Phase 23 — same slug-change redirect as products (rule #12), reusing
  // Phase 15's Redirect model/service.
  if (data.slug && data.slug !== previousSlug) {
    await redirectService
      .createRedirect(actorId, { source: `/category/${previousSlug}`, destination: `/category/${data.slug}`, statusCode: 301 })
      .catch(() => {});
  }

  return category;
}

// Refuses to delete a category that still has children or products, rather
// than silently orphaning them — the caller (controller) turns this into a
// 409 for the admin to resolve explicitly (move products/children first).
export async function deleteCategory(id) {
  const [childCount, productCount] = await Promise.all([
    Category.countDocuments({ parent: id }),
    Product.countDocuments({ category: id }),
  ]);
  if (childCount > 0 || productCount > 0) {
    const err = new Error(
      `Cannot delete: category has ${productCount} product(s) and ${childCount} subcategor${childCount === 1 ? "y" : "ies"}. Reassign them first.`
    );
    err.statusCode = 409;
    throw err;
  }
  const category = await Category.findByIdAndDelete(id);
  return category;
}

export async function getCategoryTree() {
  const categories = await Category.find({ status: "active" }).sort({ sortOrder: 1, name: 1 });
  const byParent = {};
  categories.forEach((c) => {
    const key = c.parent ? String(c.parent) : "root";
    (byParent[key] ||= []).push(c);
  });
  const build = (parentKey) =>
    (byParent[parentKey] || []).map((c) => ({ ...c.toObject(), children: build(String(c._id)) }));
  return build("root");
}

// Walks parent refs up to the root — powers real breadcrumbs instead of a
// hardcoded path.
export async function getCategoryBreadcrumb(category) {
  const trail = [category];
  let current = category;
  while (current.parent) {
    current = await Category.findById(current.parent);
    if (!current) break;
    trail.unshift(current);
  }
  return trail;
}
