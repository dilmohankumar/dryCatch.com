import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";

export default function RatingStars({ rating = 0, reviews, size = 14 }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <View style={styles.row}>
      {stars.map((s) => (
        <Ionicons
          key={s}
          name={rating >= s ? "star" : rating >= s - 0.5 ? "star-half" : "star-outline"}
          size={size}
          color={COLORS.starFilled}
        />
      ))}
      {typeof reviews === "number" && <Text style={styles.reviews}>({reviews})</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 2 },
  reviews: { marginLeft: 4, fontSize: 12, color: COLORS.textSecondary },
});
