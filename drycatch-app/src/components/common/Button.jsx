import { Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";
import { COLORS, RADIUS } from "../../constants/theme";

export default function Button({ title, onPress, variant = "primary", loading, disabled, style }) {
  const isOutline = variant === "outline";
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        isOutline ? styles.outline : styles.primary,
        isDisabled && styles.disabled,
        pressed && !isDisabled && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? COLORS.navy : COLORS.white} />
      ) : (
        <Text style={[styles.text, isOutline && styles.textOutline]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 50,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primary: { backgroundColor: COLORS.navy },
  outline: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: COLORS.navy },
  disabled: { opacity: 0.5 },
  text: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
  textOutline: { color: COLORS.navy },
});
