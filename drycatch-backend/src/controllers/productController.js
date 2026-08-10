import Product from "../models/Product.js";

// GET /products?search=&category=&page=&limit=
export async function getProducts(req, res) {
  const { search, category, page = 1, limit = 20 } = req.query;
  const filter = { isActive: true };
  if (category) filter.category = category;
  if (search) filter.$text = { $search: search };

  const skip = (Number(page) - 1) * Number(limit);
  const [products, total] = await Promise.all([
    Product.find(filter).skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
    Product.countDocuments(filter),
  ]);

  res.json({ products, total, page: Number(page), limit: Number(limit) });
}

// GET /products/featured
export async function getFeaturedProducts(req, res) {
  const products = await Product.find({ isActive: true, featured: true }).limit(12);
  res.json({ products });
}

// GET /products/category/:categoryId
export async function getProductsByCategory(req, res) {
  const products = await Product.find({ isActive: true, category: req.params.categoryId });
  res.json({ products });
}

// GET /products/:id
export async function getProductById(req, res) {
  const product = await Product.findById(req.params.id).populate("category", "name slug");
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json({ product });
}

// POST /products (admin)
export async function createProduct(req, res) {
  const product = await Product.create(req.body);
  res.status(201).json({ product });
}

// PUT /products/:id (admin)
export async function updateProduct(req, res) {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json({ product });
}

// DELETE /products/:id (admin)
export async function deleteProduct(req, res) {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json({ message: "Product deleted" });
}
