import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Category from "../models/Category.js";
import ProductVariant from "../models/ProductVariant.js";
import * as inventoryService from "../services/inventoryService.js";
import * as productService from "../services/productService.js";
import { ensureDefaultTenant } from "../services/tenant/tenantProvisioningService.js";
import { generateUniqueSlug } from "../utils/slugify.js";

// Dev/demo seed only — creates a small, realistic catalog through the real
// productService pipeline (so search indexing, slug generation, and
// tenant-scoping all happen exactly as they would from the admin API),
// plus variants and real inventory so cart/checkout can be exercised
// end-to-end. Idempotent: skips a category/product that already exists by
// slug rather than duplicating on repeat runs.
const CATEGORIES = [
  { name: "Dry Fish" },
  { name: "Prawns & Shrimp" },
  { name: "Salted Fish" },
];

const PRODUCTS = [
  { name: "Bombay Duck (Bombil)", category: "Dry Fish", price: 450, mrp: 550, shortDescription: "Classic Konkan-style sun-dried Bombay Duck", weight: "250g", origin: "Maharashtra", emoji: "🐟" },
  { name: "Dry Prawns (Sungat)", category: "Prawns & Shrimp", price: 620, mrp: 700, shortDescription: "Sun-dried small prawns, cleaned and deveined", weight: "200g", origin: "Goa", emoji: "🦐" },
  { name: "Dry Anchovy (Mandeli)", category: "Dry Fish", price: 380, mrp: 420, shortDescription: "Crispy dried anchovies, perfect for frying", weight: "250g", origin: "Karnataka", emoji: "🐟" },
  { name: "Salted Mackerel", category: "Salted Fish", price: 340, mrp: 400, shortDescription: "Traditional salt-cured mackerel", weight: "500g", origin: "Kerala", emoji: "🐠" },
  { name: "King Fish Dry (Surmai)", category: "Dry Fish", price: 899, mrp: 999, shortDescription: "Premium sun-dried king fish steaks", weight: "500g", origin: "Maharashtra", emoji: "🐟" },
  { name: "Jumbo Dry Prawns", category: "Prawns & Shrimp", price: 1150, mrp: 1300, shortDescription: "Large sun-dried prawns, shell-on", weight: "250g", origin: "Andhra Pradesh", emoji: "🦐" },
];

async function run() {
  await connectDB();
  const tenant = await ensureDefaultTenant();

  const categoryIds = {};
  for (const c of CATEGORIES) {
    let category = await Category.findOne({ name: c.name });
    if (!category) {
      const slug = await generateUniqueSlug(c.name, (slug) => Category.exists({ slug }));
      category = await Category.create({ name: c.name, slug, status: "active" });
      console.log(`[seed] created category: ${c.name}`);
    }
    categoryIds[c.name] = category._id;
  }

  let created = 0;
  let skipped = 0;
  const Product = (await import("../models/Product.js")).default;
  for (const p of PRODUCTS) {
    const already = await Product.findOne({ name: p.name, tenant: tenant._id });
    if (already) {
      skipped++;
      continue;
    }

    const product = await productService.createProduct(
      {
        name: p.name,
        category: categoryIds[p.category],
        price: p.price,
        mrp: p.mrp,
        shortDescription: p.shortDescription,
        description: p.shortDescription,
        weight: p.weight,
        origin: p.origin,
        emoji: p.emoji,
        status: "active",
        visibility: "public",
        featured: created < 2, // first two are "featured" for the homepage rail
      },
      tenant._id
    );

    const variant = await ProductVariant.create({
      product: product._id,
      sku: `${product.slug.slice(0, 10).toUpperCase()}-${p.weight}`.replace(/\s/g, ""),
      combinationKey: "default",
      price: p.price,
      mrp: p.mrp,
      isDefault: true,
      status: "active",
      weight: { label: p.weight },
    });

    // Uses the real inventoryService pipeline (creates a StockMovement
    // audit row too) and the ACTUAL default location ("MAIN", not a
    // seed-invented one) so getAvailability() — which always resolves
    // to getDefaultLocation() when no locationId is passed — finds this
    // stock. A prior version of this script created its own "MAIN-WH"
    // location, which silently made every seeded product show as out of
    // stock everywhere in the app.
    const defaultLocationId = await inventoryService.getDefaultLocation();
    await inventoryService.receiveStock({ variantId: variant._id, locationId: defaultLocationId, quantity: 100, reason: "Demo seed" });

    created++;
    console.log(`[seed] created product: ${p.name} (${product.slug})`);
  }

  console.log(`[seed] done — ${created} created, ${skipped} already existed`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("[seed] fatal error:", err);
  process.exit(1);
});
