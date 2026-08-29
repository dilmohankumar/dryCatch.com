import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";

import { COLORS, RADIUS } from "../../src/constants/theme";
import { formatPrice } from "../../src/utils/currency";
import { fetchOrders } from "../../src/services/orderService";
import EmptyState from "../../src/components/common/EmptyState";
import ScreenContainer from "../../src/components/common/ScreenContainer";
import { useResponsive } from "../../src/hooks/useResponsive";

const STATUS_STYLE = {
  delivered: "delivered",
  cancelled: "cancelled",
  refunded: "cancelled",
};

export default function OrdersScreen() {
  const router = useRouter();
  const { gridColumns } = useResponsive();
  const isWide = gridColumns >= 3;
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      fetchOrders()
        .then((data) => active && setOrders(data.orders))
        .catch((err) => active && Alert.alert("Error", err?.message || "Failed to load orders"))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.navy} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      {orders.length === 0 ? (
        <EmptyState icon="receipt-outline" title="No orders yet" subtitle="Your placed orders will show up here" />
      ) : (
        <ScreenContainer style={{ flex: 1 }} containerStyle={{ flex: 1 }}>
        <FlatList
          key={isWide ? "wide" : "narrow"}
          data={orders}
          keyExtractor={(item) => item.id}
          numColumns={isWide ? 2 : 1}
          columnWrapperStyle={isWide ? { gap: 12 } : undefined}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <Pressable style={[styles.card, isWide && { flex: 1 }]} onPress={() => router.push(`/orders/${item.id}`)}>
              <View style={styles.cardHeader}>
                <Text style={styles.orderId}>{item.orderNumber}</Text>
                <Text style={[styles.status, styles[STATUS_STYLE[item.status] || "processing"]]}>
                  {item.status.replace(/_/g, " ")}
                </Text>
              </View>
              <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              <Text style={styles.items} numberOfLines={1}>
                {item.firstItemName}
                {item.itemCount > 1 ? ` +${item.itemCount - 1} more` : ""}
              </Text>
              <Text style={styles.total}>{formatPrice(item.totalAmount)}</Text>
            </Pressable>
          )}
        />
        </ScreenContainer>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 14, gap: 4 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },
  orderId: { fontWeight: "800", color: COLORS.textPrimary },
  status: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    textTransform: "capitalize",
  },
  delivered: { color: COLORS.success, backgroundColor: "#dcfce7" },
  cancelled: { color: COLORS.error, backgroundColor: "#fee2e2" },
  processing: { color: COLORS.amber, backgroundColor: "#fef3c7" },
  date: { fontSize: 12, color: COLORS.textSecondary },
  items: { fontSize: 13, color: COLORS.textPrimary },
  total: { fontSize: 14, fontWeight: "800", color: COLORS.navy, marginTop: 4 },
});
