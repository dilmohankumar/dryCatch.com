import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { COLORS, RADIUS } from "../../constants/theme";

// The backend's seeded catalog has no real photos yet (media/slides are
// empty) — rather than fake image URLs, fall back to the product's emoji
// on a soft tinted tile so the UI still reads as designed, not broken.
export default function ProductImage({ images, emoji, style, emojiSize = 40 }) {
  const uri = images?.[0];

  if (uri) {
    return <Image source={{ uri }} style={[styles.image, style]} contentFit="cover" />;
  }

  return (
    <View style={[styles.image, styles.placeholder, style]}>
      <Text style={{ fontSize: emojiSize }}>{emoji || "🐟"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { width: "100%", height: 130, borderRadius: RADIUS.sm, backgroundColor: COLORS.beige },
  placeholder: { alignItems: "center", justifyContent: "center" },
});
