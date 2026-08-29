import { useEffect } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";

import { COLORS } from "../../src/constants/theme";
import { formatPrice } from "../../src/utils/currency";
import CartItem from "../../src/components/cart/CartItem";
import EmptyState from "../../src/components/common/EmptyState";
import Button from "../../src/components/common/Button";
import ScreenContainer from "../../src/components/common/ScreenContainer";
import { fetchCartThunk } from "../../src/store/slices/cartSlice";

export default function CartScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const { items, summary, status } = useSelector((state) => state.cart);

  useEffect(() => {
    if (isAuthenticated) dispatch(fetchCartThunk());
  }, [dispatch, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Text style={styles.heading}>My Cart</Text>
        <EmptyState
          icon="lock-closed-outline"
          title="Login to view your cart"
          subtitle="Your cart is saved to your account"
          actionLabel="Login"
          onAction={() => router.push("/(auth)/login")}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Text style={styles.heading}>My Cart</Text>

      {status === "loading" && items.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={COLORS.navy} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="cart-outline"
          title="Your cart is empty"
          subtitle="Add some fresh catch to get started"
          actionLabel="Browse Products"
          onAction={() => router.push("/(tabs)/categories")}
        />
      ) : (
        <ScreenContainer style={{ flex: 1 }} containerStyle={{ flex: 1 }}>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <CartItem item={item} />}
            contentContainerStyle={{ paddingBottom: 12 }}
          />
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatPrice(summary.subtotal)}</Text>
            </View>
            <View style={[styles.summaryRow, { marginTop: 4 }]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPrice(summary.total)}</Text>
            </View>
            <Text style={styles.shippingNote}>Shipping & taxes calculated at checkout</Text>
            <Button title="Proceed to Checkout" onPress={() => router.push("/checkout")} style={{ marginTop: 12 }} />
          </View>
        </ScreenContainer>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  heading: { fontSize: 22, fontWeight: "800", color: COLORS.textPrimary, paddingHorizontal: 16, marginBottom: 8 },
  summary: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 16,
    backgroundColor: COLORS.surface,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  summaryLabel: { color: COLORS.textSecondary, fontSize: 13 },
  summaryValue: { color: COLORS.textPrimary, fontSize: 13, fontWeight: "600" },
  totalLabel: { color: COLORS.textPrimary, fontSize: 16, fontWeight: "800" },
  totalValue: { color: COLORS.navy, fontSize: 16, fontWeight: "800" },
  shippingNote: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
});
