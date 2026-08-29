import { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useDispatch, useSelector } from "react-redux";

import { COLORS } from "../../src/constants/theme";
import ProductCard from "../../src/components/product/ProductCard";
import EmptyState from "../../src/components/common/EmptyState";
import { fetchCategoriesThunk, fetchProductsThunk } from "../../src/store/slices/productSlice";
import { useResponsive } from "../../src/hooks/useResponsive";

export default function CategoriesScreen() {
  const params = useLocalSearchParams();
  const dispatch = useDispatch();
  const { categories, items, status } = useSelector((state) => state.products);
  const [activeSlug, setActiveSlug] = useState(params.category || null);
  const { gridColumns, cardWidth, gridGap, gridPadding } = useResponsive();

  useEffect(() => {
    dispatch(fetchCategoriesThunk());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchProductsThunk({ category: activeSlug || undefined }));
  }, [dispatch, activeSlug]);

  useEffect(() => {
    if (params.category) setActiveSlug(params.category);
  }, [params.category]);

  const chips = useMemo(() => [{ id: "all", label: "All", slug: null }, ...categories], [categories]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Text style={styles.heading}>Categories</Text>
      <FlatList
        horizontal
        data={chips}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        renderItem={({ item }) => {
          const isActive = activeSlug === item.slug;
          return (
            <Pressable
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => setActiveSlug(item.slug)}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          );
        }}
      />

      {status === "loading" ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={COLORS.navy} />
      ) : items.length === 0 ? (
        <EmptyState icon="fish-outline" title="No products found" subtitle="Try a different category" />
      ) : (
        <FlatList
          key={gridColumns}
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={gridColumns}
          columnWrapperStyle={{ gap: gridGap, paddingHorizontal: gridPadding }}
          contentContainerStyle={{ gap: gridGap, paddingBottom: 24, paddingTop: 12 }}
          renderItem={({ item }) => <ProductCard product={item} width={cardWidth} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  heading: { fontSize: 22, fontWeight: "800", color: COLORS.textPrimary, paddingHorizontal: 16, marginBottom: 8 },
  chipRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  chipText: { fontSize: 12, fontWeight: "600", color: COLORS.textPrimary },
  chipTextActive: { color: COLORS.white },
});
