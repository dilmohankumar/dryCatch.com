import User from "../models/User.js";

async function populatedCart(userId) {
  const user = await User.findById(userId).populate("cart.product");
  return user.cart;
}

// GET /cart
export async function getCart(req, res) {
  res.json({ cart: await populatedCart(req.user._id) });
}

// POST /cart/add — { productId, quantity }
export async function addToCart(req, res) {
  const { productId, quantity = 1 } = req.body;
  const existing = req.user.cart.find((item) => String(item.product) === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    req.user.cart.push({ product: productId, quantity });
  }
  await req.user.save();
  res.status(201).json({ cart: await populatedCart(req.user._id) });
}

// PUT /cart/:productId — { quantity }
export async function updateCartItem(req, res) {
  const { quantity } = req.body;
  const item = req.user.cart.find((i) => String(i.product) === req.params.productId);
  if (!item) return res.status(404).json({ message: "Item not in cart" });
  item.quantity = quantity;
  await req.user.save();
  res.json({ cart: await populatedCart(req.user._id) });
}

// DELETE /cart/:productId
export async function removeFromCart(req, res) {
  req.user.cart = req.user.cart.filter((i) => String(i.product) !== req.params.productId);
  await req.user.save();
  res.json({ cart: await populatedCart(req.user._id) });
}

// DELETE /cart
export async function clearCart(req, res) {
  req.user.cart = [];
  await req.user.save();
  res.json({ cart: [] });
}
