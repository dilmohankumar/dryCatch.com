import { View, Text, StyleSheet } from "react-native";
import { COLORS, RADIUS } from "../../constants/theme";

export default function HeroBanner() {
  return (
    <View style={styles.banner}>
      <Text style={styles.kicker}>Fresh from the coast</Text>
      <Text style={styles.title}>Sun-dried. Sea-fresh.{"\n"}Straight to your door.</Text>
      <View style={styles.pill}>
        <Text style={styles.pillText}>Shop Bestsellers →</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.lg,
    padding: 20,
  },
  kicker: { color: COLORS.amber, fontWeight: "700", fontSize: 12, letterSpacing: 1 },
  title: { color: COLORS.white, fontSize: 22, fontWeight: "800", marginTop: 8, lineHeight: 28 },
  pill: {
    marginTop: 16,
    alignSelf: "flex-start",
    backgroundColor: COLORS.amber,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  pillText: { color: COLORS.navy, fontWeight: "700", fontSize: 12 },
});
