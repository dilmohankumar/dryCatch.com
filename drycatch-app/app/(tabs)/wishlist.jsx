import { useEffect } from "react";
import { Text, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";

import { COLORS } from "../../src/constants/theme";
import ProductCard from "../../src/components/product/ProductCard";
import EmptyState from "../../src/components/common/EmptyState";
import { fetchWishlistThunk } from "../../src/store/slices/wishlistSlice";
import { useResponsive } from "../../src/hooks/useResponsive";

export default function WishlistScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const { items, status } = useSelector((state) => state.wishlist);
  const { gridColumns, cardWidth, gridGap, gridPadding } = useResponsive();

  useEffect(() => {
    if (isAuthenticated) dispatch(fetchWishlistThunk());
  }, [dispatch, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Text style={styles.heading}>Wishlist</Text>
        <EmptyState
          icon="lock-closed-outline"
          title="Login to view your wishlist"
          subtitle="Saved products sync to your account"
          actionLabel="Login"
          onAction={() => router.push("/(auth)/login")}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Text style={styles.heading}>Wishlist</Text>
      {status === "loading" && items.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={COLORS.navy} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="heart-outline"
          title="Your wishlist is empty"
          subtitle="Save products you love for later"
          actionLabel="Browse Products"
          onAction={() => router.push("/(tabs)/categories")}
        />
      ) : (
        <FlatList
          key={gridColumns}
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={gridColumns}
          columnWrapperStyle={{ gap: gridGap, paddingHorizontal: gridPadding }}
          contentContainerStyle={{ gap: gridGap, paddingBottom: 24 }}
          renderItem={({ item }) => <ProductCard product={item} width={cardWidth} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  heading: { fontSize: 22, fontWeight: "800", color: COLORS.textPrimary, paddingHorizontal: 16, marginBottom: 8 },
});
