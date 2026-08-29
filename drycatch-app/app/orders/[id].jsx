import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { COLORS, RADIUS } from "../../src/constants/theme";
import { formatPrice } from "../../src/utils/currency";
import { fetchOrderById, cancelOrder } from "../../src/services/orderService";
import EmptyState from "../../src/components/common/EmptyState";
import Button from "../../src/components/common/Button";
import ScreenContainer from "../../src/components/common/ScreenContainer";

const CANCELLABLE_STATUSES = ["pending_payment", "payment_processing", "confirmed"];

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const load = () => {
    setLoading(true);
    fetchOrderById(id)
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const onCancel = () => {
    Alert.alert("Cancel order", "Are you sure you want to cancel this order?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, cancel",
        style: "destructive",
        onPress: async () => {
          setCancelling(true);
          try {
            await cancelOrder(id);
            load();
          } catch (err) {
            Alert.alert("Couldn't cancel", err?.message || "Please try again");
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.navy} />
      </View>
    );
  }

  if (!order) {
    return <EmptyState icon="alert-circle-outline" title="Order not found" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ alignItems: "center" }}>
      <ScreenContainer style={{ padding: 16 }}>
        <Text style={styles.orderId}>{order.orderNumber}</Text>
        <Text style={styles.status}>{order.status.replace(/_/g, " ")}</Text>
        <Text style={styles.date}>Placed on {new Date(order.createdAt).toLocaleDateString()}</Text>

        <Text style={styles.sectionTitle}>Items</Text>
        {order.items.map((item, index) => (
          <View key={index} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>
                {item.sku ? `${item.sku} · ` : ""}x{item.quantity}
              </Text>
            </View>
            <Text style={styles.itemPrice}>{formatPrice(item.lineTotal)}</Text>
          </View>
        ))}

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatPrice(order.subtotal)}</Text>
        </View>
        {order.discountAmount > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Discount {order.couponCode ? `(${order.couponCode})` : ""}</Text>
            <Text style={styles.summaryValue}>-{formatPrice(order.discountAmount)}</Text>
          </View>
        )}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Shipping</Text>
          <Text style={styles.summaryValue}>{formatPrice(order.shippingCost)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tax</Text>
          <Text style={styles.summaryValue}>{formatPrice(order.taxAmount)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPrice(order.totalAmount)}</Text>
        </View>

        {order.shippingAddress && (
          <>
            <Text style={styles.sectionTitle}>Delivery address</Text>
            <Text style={styles.addressText}>
              {order.shippingAddress.line1}, {order.shippingAddress.city}, {order.shippingAddress.state} -{" "}
              {order.shippingAddress.pincode}
            </Text>
            <Text style={styles.addressText}>{order.shippingAddress.phone}</Text>
          </>
        )}

        {CANCELLABLE_STATUSES.includes(order.status) && (
          <Button title="Cancel Order" variant="outline" loading={cancelling} onPress={onCancel} style={{ marginTop: 24 }} />
        )}
      </ScreenContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  orderId: { fontSize: 20, fontWeight: "800", color: COLORS.textPrimary },
  status: { fontSize: 13, fontWeight: "700", color: COLORS.navy, marginTop: 4, textTransform: "capitalize" },
  date: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: COLORS.textPrimary, marginTop: 20, marginBottom: 8 },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemName: { fontSize: 14, fontWeight: "600", color: COLORS.textPrimary },
  itemMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  summaryLabel: { fontSize: 13, color: COLORS.textSecondary },
  summaryValue: { fontSize: 13, fontWeight: "600", color: COLORS.textPrimary },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  totalLabel: { fontSize: 16, fontWeight: "800", color: COLORS.textPrimary },
  totalValue: { fontSize: 16, fontWeight: "800", color: COLORS.navy },
  addressText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
});
