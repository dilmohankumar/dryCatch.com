import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS, SHADOW } from "../../constants/theme";
import { formatPrice } from "../../utils/currency";
import ProductImage from "./ProductImage";
import RatingStars from "../common/RatingStars";
import { addToWishlistThunk, removeFromWishlistThunk, selectIsWishlisted } from "../../store/slices/wishlistSlice";
import { addCartItemThunk } from "../../store/slices/cartSlice";
import { fetchProductByIdOrSlug } from "../../services/productService";

export default function ProductCard({ product, width }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const wishlisted = useSelector((state) => selectIsWishlisted(state, product.id));

  const requireAuth = () => {
    Alert.alert("Login required", "Please login to continue.", [
      { text: "Cancel", style: "cancel" },
      { text: "Login", onPress: () => router.push("/(auth)/login") },
    ]);
  };

  const onToggleWishlist = (e) => {
    e.stopPropagation?.();
    if (!isAuthenticated) return requireAuth();
    dispatch(wishlisted ? removeFromWishlistThunk(product.id) : addToWishlistThunk(product.id));
  };

  const onAddToCart = async (e) => {
    e.stopPropagation?.();
    if (!isAuthenticated) return requireAuth();
    // Wishlist/search results don't carry defaultVariantId (only the
    // main product-list/detail endpoints compute it) — fetch it lazily.
    let variantId = product.defaultVariantId;
    if (!variantId) {
      const full = await fetchProductByIdOrSlug(product.slug || product.id);
      variantId = full?.defaultVariantId;
    }
    if (!variantId) return Alert.alert("Unavailable", "This product has no purchasable size right now.");
    dispatch(addCartItemThunk({ variantId, quantity: 1 }));
  };

  return (
    <Pressable
      style={[styles.card, width ? { width } : null]}
      onPress={() => router.push(`/product/${product.slug || product.id}`)}
    >
      <View style={styles.imageWrap}>
        <ProductImage
          images={product.images}
          emoji={product.emoji}
          style={width ? { height: width * 0.78 } : null}
          emojiSize={width ? Math.round(width * 0.24) : 40}
        />
        <Pressable style={styles.wishlistBtn} onPress={onToggleWishlist}>
          <Ionicons name={wishlisted ? "heart" : "heart-outline"} size={18} color={COLORS.maroon} />
        </Pressable>
        {product.discountPct > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{product.discountPct}% OFF</Text>
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={styles.name}>
        {product.name}
      </Text>
      <RatingStars rating={product.rating} reviews={product.reviewsCount} />
      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatPrice(product.price)}</Text>
        {product.mrp > product.price && <Text style={styles.mrp}>{formatPrice(product.mrp)}</Text>}
      </View>
      <Pressable style={styles.addBtn} onPress={onAddToCart}>
        <Ionicons name="cart-outline" size={16} color={COLORS.white} />
        <Text style={styles.addBtnText}>Add</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 168,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: 8,
    ...SHADOW.card,
  },
  imageWrap: { position: "relative" },
  wishlistBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    padding: 5,
  },
  discountBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: COLORS.green,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  discountText: { color: COLORS.white, fontSize: 10, fontWeight: "700" },
  name: { marginTop: 8, fontSize: 13, fontWeight: "600", color: COLORS.textPrimary },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  price: { fontSize: 14, fontWeight: "800", color: COLORS.navy },
  mrp: { fontSize: 12, color: COLORS.textSecondary, textDecorationLine: "line-through" },
  addBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: COLORS.amber,
    borderRadius: RADIUS.sm,
    height: 34,
  },
  addBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 12 },
});
