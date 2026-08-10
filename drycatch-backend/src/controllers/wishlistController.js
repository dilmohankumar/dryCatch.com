import User from "../models/User.js";

async function populatedWishlist(userId) {
  const user = await User.findById(userId).populate("wishlist");
  return user.wishlist;
}

// GET /wishlist
export async function getWishlist(req, res) {
  res.json({ wishlist: await populatedWishlist(req.user._id) });
}

// POST /wishlist/add — { productId }
export async function addToWishlist(req, res) {
  const { productId } = req.body;
  if (!req.user.wishlist.some((id) => String(id) === productId)) {
    req.user.wishlist.push(productId);
    await req.user.save();
  }
  res.status(201).json({ wishlist: await populatedWishlist(req.user._id) });
}

// DELETE /wishlist/:productId
export async function removeFromWishlist(req, res) {
  req.user.wishlist = req.user.wishlist.filter((id) => String(id) !== req.params.productId);
  await req.user.save();
  res.json({ wishlist: await populatedWishlist(req.user._id) });
}

// DELETE /wishlist
export async function clearWishlist(req, res) {
  req.user.wishlist = [];
  await req.user.save();
  res.json({ wishlist: [] });
}
