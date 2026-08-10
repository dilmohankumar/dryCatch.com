import Review from "../models/Review.js";
import Product from "../models/Product.js";

async function recomputeProductRating(productId) {
  const reviews = await Review.find({ product: productId });
  const reviewsCount = reviews.length;
  const rating = reviewsCount ? reviews.reduce((s, r) => s + r.rating, 0) / reviewsCount : 0;
  await Product.findByIdAndUpdate(productId, { rating, reviewsCount });
}

// GET /reviews/product/:productId
export async function getReviewsByProduct(req, res) {
  const reviews = await Review.find({ product: req.params.productId })
    .populate("user", "firstName lastName")
    .sort({ createdAt: -1 });
  res.json({ reviews });
}

// POST /reviews — { product, rating, comment }
export async function createReview(req, res) {
  const { product, rating, comment } = req.body;
  const review = await Review.create({ product, rating, comment, user: req.user._id });
  await recomputeProductRating(product);
  res.status(201).json({ review });
}

// PUT /reviews/:id — { rating, comment }
export async function updateReview(req, res) {
  const review = await Review.findOne({ _id: req.params.id, user: req.user._id });
  if (!review) return res.status(404).json({ message: "Review not found" });

  if (req.body.rating !== undefined) review.rating = req.body.rating;
  if (req.body.comment !== undefined) review.comment = req.body.comment;
  await review.save();
  await recomputeProductRating(review.product);

  res.json({ review });
}

// DELETE /reviews/:id
export async function deleteReview(req, res) {
  const review = await Review.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!review) return res.status(404).json({ message: "Review not found" });
  await recomputeProductRating(review.product);
  res.json({ message: "Review deleted" });
}

// PUT /reviews/:id/helpful
export async function markHelpful(req, res) {
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ message: "Review not found" });

  const alreadyMarked = review.helpfulBy.some((id) => String(id) === String(req.user._id));
  if (!alreadyMarked) {
    review.helpfulBy.push(req.user._id);
    review.helpfulCount += 1;
    await review.save();
  }
  res.json({ review });
}
