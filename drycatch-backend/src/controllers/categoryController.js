import Category from "../models/Category.js";

// GET /categories
export async function getCategories(req, res) {
  const categories = await Category.find();
  res.json({ categories });
}

// GET /categories/tree
export async function getCategoryTree(req, res) {
  const categories = await Category.find();
  const byParent = {};
  categories.forEach((c) => {
    const key = c.parent ? String(c.parent) : "root";
    (byParent[key] ||= []).push(c);
  });
  const build = (parentKey) =>
    (byParent[parentKey] || []).map((c) => ({
      ...c.toObject(),
      children: build(String(c._id)),
    }));
  res.json({ tree: build("root") });
}

// GET /categories/:id
export async function getCategoryById(req, res) {
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ message: "Category not found" });
  res.json({ category });
}

// POST /categories (admin)
export async function createCategory(req, res) {
  const category = await Category.create(req.body);
  res.status(201).json({ category });
}

// PUT /categories/:id (admin)
export async function updateCategory(req, res) {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!category) return res.status(404).json({ message: "Category not found" });
  res.json({ category });
}

// DELETE /categories/:id (admin)
export async function deleteCategory(req, res) {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) return res.status(404).json({ message: "Category not found" });
  res.json({ message: "Category deleted" });
}
