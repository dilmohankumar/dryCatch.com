import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";

import { COLORS, RADIUS } from "../../src/constants/theme";
import { formatPrice } from "../../src/utils/currency";
import { fetchProductByIdOrSlug, fetchProductVariants, fetchProducts } from "../../src/services/productService";
import ProductImage from "../../src/components/product/ProductImage";
import RatingStars from "../../src/components/common/RatingStars";
import Button from "../../src/components/common/Button";
import ScreenContainer from "../../src/components/common/ScreenContainer";
import ProductCarousel from "../../src/components/home/ProductCarousel";
import SectionHeading from "../../src/components/home/SectionHeading";
import { addCartItemThunk } from "../../src/store/slices/cartSlice";
import { addToWishlistThunk, removeFromWishlistThunk, selectIsWishlisted } from "../../src/store/slices/wishlistSlice";

export default function ProductDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const wishlisted = useSelector((state) => (product ? selectIsWishlisted(state, product.id) : false));

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const productData = await fetchProductByIdOrSlug(id);
        if (!active) return;
        setProduct(productData);

        const variantList = await fetchProductVariants(productData.id);
        if (!active) return;
        setVariants(variantList);
        setSelectedVariant(
          variantList.find((v) => v.isDefault) ||
            variantList[0] || {
              id: productData.defaultVariantId,
              label: productData.weight?.label || "Standard",
              price: productData.price,
              mrp: productData.mrp,
              status: "active",
            }
        );

        if (productData.categorySlug) {
          const { items } = await fetchProducts({ category: productData.categorySlug, limit: 8 });
          if (active) setRelated(items.filter((p) => p.id !== productData.id));
        }
      } catch (err) {
        if (active) Alert.alert("Error", err?.message || "Failed to load product");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading || !product || !selectedVariant) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.navy} />
      </View>
    );
  }

  const discount = selectedVariant.discountPct || product.discountPct || 0;
  const isOutOfStock = selectedVariant.status !== "active";

  const requireAuth = () => {
    Alert.alert("Login required", "Please login to continue.", [
      { text: "Cancel", style: "cancel" },
      { text: "Login", onPress: () => router.push("/(auth)/login") },
    ]);
  };

  const onToggleWishlist = () => {
    if (!isAuthenticated) return requireAuth();
    dispatch(wishlisted ? removeFromWishlistThunk(product.id) : addToWishlistThunk(product.id));
  };

  const onAddToCart = async () => {
    if (!isAuthenticated) return requireAuth();
    setAddingToCart(true);
    try {
      await dispatch(addCartItemThunk({ variantId: selectedVariant.id, quantity })).unwrap();
      Alert.alert("Added to cart", `${product.name} (${selectedVariant.label}) x${quantity}`);
    } catch (err) {
      Alert.alert("Couldn't add to cart", err?.message || "Please try again");
    } finally {
      setAddingToCart(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24, alignItems: "center" }}>
        <ProductImage images={product.images} emoji={product.emoji} style={styles.hero} emojiSize={72} />

        <ScreenContainer style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{product.name}</Text>
            <Pressable onPress={onToggleWishlist}>
              <Ionicons name={wishlisted ? "heart" : "heart-outline"} size={24} color={COLORS.maroon} />
            </Pressable>
          </View>
          <RatingStars rating={product.rating} reviews={product.reviewsCount} size={16} />

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(selectedVariant.price)}</Text>
            {selectedVariant.mrp > selectedVariant.price && (
              <>
                <Text style={styles.mrp}>{formatPrice(selectedVariant.mrp)}</Text>
                <Text style={styles.discount}>{discount}% off</Text>
              </>
            )}
          </View>

          {variants.length > 1 && (
            <>
              <Text style={styles.sectionTitle}>Select size</Text>
              <View style={styles.variantRow}>
                {variants.map((v) => (
                  <Pressable
                    key={v.id}
                    disabled={v.status !== "active"}
                    onPress={() => setSelectedVariant(v)}
                    style={[
                      styles.variantChip,
                      selectedVariant.id === v.id && styles.variantChipActive,
                      v.status !== "active" && styles.variantChipDisabled,
                    ]}
                  >
                    <Text style={[styles.variantText, selectedVariant.id === v.id && styles.variantTextActive]}>
                      {v.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          {isOutOfStock && <Text style={styles.outStock}>Out of stock</Text>}

          <Text style={styles.sectionTitle}>Quantity</Text>
          <View style={styles.stepper}>
            <Pressable style={styles.stepBtn} onPress={() => setQuantity((q) => Math.max(1, q - 1))}>
              <Ionicons name="remove" size={18} color={COLORS.navy} />
            </Pressable>
            <Text style={styles.qty}>{quantity}</Text>
            <Pressable style={styles.stepBtn} onPress={() => setQuantity((q) => q + 1)}>
              <Ionicons name="add" size={18} color={COLORS.navy} />
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{product.description}</Text>

          {related.length > 0 && (
            <>
              <View style={{ height: 16 }} />
              <SectionHeading title="You may also like" />
              <ProductCarousel products={related} />
            </>
          )}
        </ScreenContainer>
      </ScrollView>

      <ScreenContainer style={styles.bottomBar}>
        <Button
          title={isOutOfStock ? "Out of Stock" : "Add to Cart"}
          disabled={isOutOfStock}
          loading={addingToCart}
          onPress={onAddToCart}
          style={{ flex: 1 }}
        />
      </ScreenContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { width: "100%", height: 320, borderRadius: 0 },
  content: { padding: 16, gap: 6 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  name: { fontSize: 20, fontWeight: "800", color: COLORS.textPrimary, flex: 1, marginRight: 8 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  price: { fontSize: 22, fontWeight: "900", color: COLORS.navy },
  mrp: { fontSize: 14, color: COLORS.textSecondary, textDecorationLine: "line-through" },
  discount: { fontSize: 13, fontWeight: "700", color: COLORS.green },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary, marginTop: 18, marginBottom: 8 },
  variantRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  variantChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  variantChipActive: { borderColor: COLORS.navy, backgroundColor: COLORS.navy },
  variantChipDisabled: { opacity: 0.4 },
  variantText: { fontSize: 13, fontWeight: "600", color: COLORS.textPrimary },
  variantTextActive: { color: COLORS.white },
  outStock: { color: COLORS.error, fontSize: 12, fontWeight: "600", marginTop: 6 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stepBtn: { padding: 4 },
  qty: { fontSize: 15, fontWeight: "700", minWidth: 20, textAlign: "center" },
  description: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  bottomBar: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
});
