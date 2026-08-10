import crypto from "crypto";
import Order from "../models/Order.js";
import { razorpay } from "../utils/razorpay.js";

// POST /orders — { items: [{product, name, variantLabel, price, quantity}], shippingAddress }
// Creates a DB order + a matching Razorpay order for the client to open checkout with.
export async function createOrder(req, res) {
  const { items, shippingAddress } = req.body;
  if (!items?.length) return res.status(400).json({ message: "Order must contain at least one item" });

  const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(totalAmount * 100),
    currency: "INR",
    receipt: `rcpt_${Date.now()}`,
  });

  const order = await Order.create({
    user: req.user._id,
    items,
    totalAmount,
    shippingAddress,
    razorpayOrderId: razorpayOrder.id,
  });

  res.status(201).json({ order, razorpayOrderId: razorpayOrder.id, amount: razorpayOrder.amount });
}

// POST /orders/verify — { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
export async function verifyPayment(req, res) {
  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ message: "Payment verification failed" });
  }

  const order = await Order.findOneAndUpdate(
    { _id: orderId, user: req.user._id },
    { status: "paid", razorpayPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature },
    { new: true }
  );
  if (!order) return res.status(404).json({ message: "Order not found" });

  res.json({ order });
}

// GET /orders/my-orders
export async function getMyOrders(req, res) {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ orders });
}

// GET /orders/:id
export async function getOrderById(req, res) {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (String(order.user) !== String(req.user._id) && req.user.role !== "admin") {
    return res.status(403).json({ message: "Not authorized to view this order" });
  }
  res.json({ order });
}

// PUT /orders/:id/cancel
export async function cancelOrder(req, res) {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (["shipped", "delivered"].includes(order.status)) {
    return res.status(400).json({ message: `Cannot cancel an order that is already ${order.status}` });
  }
  order.status = "cancelled";
  await order.save();
  res.json({ order });
}

// GET /orders (admin)
export async function getAllOrders(req, res) {
  const orders = await Order.find().sort({ createdAt: -1 }).populate("user", "firstName lastName email");
  res.json({ orders });
}

// PUT /orders/:id/status (admin) — { status }
export async function updateOrderStatus(req, res) {
  const { status } = req.body;
  const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!order) return res.status(404).json({ message: "Order not found" });
  res.json({ order });
}
