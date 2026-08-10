import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

const v1 = express.Router();
v1.use("/auth", authRoutes);
v1.use("/products", productRoutes);
v1.use("/categories", categoryRoutes);
v1.use("/cart", cartRoutes);
v1.use("/wishlist", wishlistRoutes);
v1.use("/orders", orderRoutes);
v1.use("/reviews", reviewRoutes);
app.use("/api/v1", v1);

app.use(notFound);
app.use(errorHandler);

export default app;
