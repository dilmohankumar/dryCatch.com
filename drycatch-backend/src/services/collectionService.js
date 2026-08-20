import Collection from "../models/Collection.js";
import Product from "../models/Product.js";
import { generateUniqueSlug } from "../utils/slugify.js";

const WRITABLE_FIELDS = ["name", "description", "image", "status", "sortOrder", "seo"];

function pickWritable(body) {
  const out = {};
  for (const field of WRITABLE_FIELDS) {
    if (body[field] !== undefined) out[field] = body[field];
  }
  return out;
}

export async function createCollection(body) {
  const data = pickWritable(body);
  if (!data.name) throw Object.assign(new Error("name is required"), { statusCode: 400 });
  data.slug = await generateUniqueSlug(data.name, (slug) => Collection.exists({ slug }));
  return Collection.create(data);
}

export async function updateCollection(id, body) {
  const collection = await Collection.findById(id);
  if (!collection) return null;
  Object.assign(collection, pickWritable(body));
  await collection.save();
  return collection;
}

export async function deleteCollection(id) {
  const productCount = await Product.countDocuments({ collections: id });
  if (productCount > 0) {
    const err = new Error(`Cannot delete: ${productCount} product(s) still belong to this collection. Reassign them first.`);
    err.statusCode = 409;
    throw err;
  }
  return Collection.findByIdAndDelete(id);
}
