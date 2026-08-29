import { View, Text, Pressable, StyleSheet } from "react-native";
import { COLORS } from "../../constants/theme";

export default function SectionHeading({ title, actionLabel, onAction }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onAction}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "800", color: COLORS.textPrimary },
  action: { fontSize: 13, fontWeight: "700", color: COLORS.navy },
});
