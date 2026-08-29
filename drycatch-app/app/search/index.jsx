import { useEffect, useState } from "react";
import { View, TextInput, FlatList, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { COLORS, RADIUS } from "../../src/constants/theme";
import { formatPrice } from "../../src/utils/currency";
import { useDebounce } from "../../src/hooks/useDebounce";
import * as searchService from "../../src/services/searchService";
import RatingStars from "../../src/components/common/RatingStars";
import EmptyState from "../../src/components/common/EmptyState";

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 350);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    searchService
      .search(debouncedQuery)
      .then((data) => active && setResults(data.products || []))
      .catch(() => active && setResults([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  const onSelectResult = (item, index) => {
    searchService.trackResultClick({ query: debouncedQuery, productId: item.productId, position: index });
    router.push(`/product/${item.slug || item.productId}`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={styles.input}
          placeholder="Search dry fish, prawns, combos..."
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")}>
            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
          </Pressable>
        )}
      </View>

      {!debouncedQuery ? (
        <EmptyState icon="search-outline" title="Search dryCatch" subtitle="Try “prawns”, “bombay duck”, “combo”" />
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={COLORS.navy} />
      ) : results.length === 0 ? (
        <EmptyState icon="search-outline" title="No results found" subtitle={`Nothing matched "${debouncedQuery}"`} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.productId}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
          renderItem={({ item, index }) => (
            <Pressable style={styles.row} onPress={() => onSelectResult(item, index)}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.name}>
                  {item.name}
                </Text>
                <Text style={styles.category}>{item.category}</Text>
                <RatingStars rating={item.rating} reviews={item.reviewCount} />
              </View>
              <Text style={styles.price}>{formatPrice(item.price)}</Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
  },
  input: { flex: 1, fontSize: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  name: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  category: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, marginBottom: 4 },
  price: { fontSize: 14, fontWeight: "800", color: COLORS.navy },
});
