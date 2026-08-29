import { View, StyleSheet } from "react-native";
import { useResponsive } from "../../hooks/useResponsive";

// Centers a capped-width reading column on tablets (forms, product detail,
// checkout, order detail) instead of letting text/inputs stretch edge to
// edge on a 10-13" screen. On phones this is a no-op (full width).
export default function ScreenContainer({ children, style, containerStyle }) {
  const { contentMaxWidth } = useResponsive();
  return (
    <View style={[styles.outer, containerStyle]}>
      <View style={[{ width: "100%", maxWidth: contentMaxWidth }, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { alignItems: "center", width: "100%" },
});
