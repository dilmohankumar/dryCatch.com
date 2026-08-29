import { useEffect } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "../../src/constants/theme";
import Logo from "../../src/components/common/Logo";
import CategoryStrip from "../../src/components/home/CategoryStrip";
import HeroBanner from "../../src/components/home/HeroBanner";
import SectionHeading from "../../src/components/home/SectionHeading";
import ProductCarousel from "../../src/components/home/ProductCarousel";
import { fetchCategoriesThunk, fetchFeaturedThunk, fetchProductsThunk } from "../../src/store/slices/productSlice";

const TRUST_POINTS = [
  { id: "tr-1", icon: "shield-checkmark", title: "Quality Assured", subtitle: "Handpicked & sun-dried" },
  { id: "tr-2", icon: "flash", title: "Fast Delivery", subtitle: "Shipped within 24 hours" },
  { id: "tr-3", icon: "leaf", title: "No Preservatives", subtitle: "100% natural" },
];

export default function HomeScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { categories, featured, items } = useSelector((state) => state.products);

  useEffect(() => {
    dispatch(fetchCategoriesThunk());
    dispatch(fetchFeaturedThunk());
    dispatch(fetchProductsThunk({}));
  }, [dispatch]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Logo />
        <Pressable onPress={() => router.push("/search")} style={styles.searchBtn}>
          <Ionicons name="search" size={18} color={COLORS.textSecondary} />
          <Text style={styles.searchText}>Search dry fish, prawns...</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <CategoryStrip categories={categories} />

        <View style={{ height: 16 }} />
        <HeroBanner />

        <View style={{ height: 24 }} />
        <SectionHeading title="Explore Greatest Hits" actionLabel="See all" onAction={() => router.push("/(tabs)/categories")} />
        <ProductCarousel products={featured} />

        <View style={styles.trustBar}>
          {TRUST_POINTS.map((point) => (
            <View key={point.id} style={styles.trustItem}>
              <Ionicons name={point.icon} size={22} color={COLORS.navy} />
              <Text style={styles.trustTitle}>{point.title}</Text>
              <Text style={styles.trustSubtitle}>{point.subtitle}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 24 }} />
        <SectionHeading title="New Arrivals" actionLabel="See all" onAction={() => router.push("/(tabs)/categories")} />
        <ProductCarousel products={items} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchText: { color: COLORS.textSecondary, fontSize: 13 },
  trustBar: {
    marginTop: 24,
    marginHorizontal: 16,
    backgroundColor: COLORS.beige,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
  },
  trustItem: { alignItems: "center", flex: 1, gap: 4 },
  trustTitle: { fontSize: 11, fontWeight: "700", color: COLORS.textPrimary, textAlign: "center" },
  trustSubtitle: { fontSize: 9, color: COLORS.textSecondary, textAlign: "center" },
});
