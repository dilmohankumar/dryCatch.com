import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../../constants/theme";

export default function Logo({ size = 22 }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.text, { fontSize: size }]}>dryCatch</Text>
      <Text style={{ fontSize: size * 0.8 }}> 🦐🐟</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  text: { fontWeight: "900", color: COLORS.navy, letterSpacing: 0.3 },
});
