import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { COLORS } from "../../constants/theme";

// The backend's Category model carries no icon/color — these are purely a
// cosmetic, deterministic cycle so each chip still looks distinct.
const SWATCHES = [COLORS.beige, "#EAF2F8", "#FBEAE7", "#EFF7EE", "#F0EAF8", "#FDF3E0"];

export default function CategoryStrip({ categories }) {
  const router = useRouter();

  return (
    <FlatList
      horizontal
      data={categories}
      keyExtractor={(item) => item.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      renderItem={({ item, index }) => (
        <Pressable
          style={styles.item}
          onPress={() => router.push({ pathname: "/(tabs)/categories", params: { category: item.slug } })}
        >
          <View style={[styles.circle, { backgroundColor: SWATCHES[index % SWATCHES.length] }]}>
            <Text style={styles.emoji}>🐟</Text>
          </View>
          <Text numberOfLines={1} style={styles.label}>
            {item.label}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, gap: 16 },
  item: { alignItems: "center", width: 72 },
  circle: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 26 },
  label: { marginTop: 6, fontSize: 11, fontWeight: "600", color: COLORS.textPrimary, textAlign: "center" },
});
