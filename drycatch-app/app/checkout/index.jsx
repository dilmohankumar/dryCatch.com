import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";

import { COLORS, RADIUS } from "../../src/constants/theme";
import { formatPrice } from "../../src/utils/currency";
import * as addressService from "../../src/services/addressService";
import * as checkoutService from "../../src/services/checkoutService";
import * as orderService from "../../src/services/orderService";
import { fetchCartThunk } from "../../src/store/slices/cartSlice";
import Button from "../../src/components/common/Button";
import ScreenContainer from "../../src/components/common/ScreenContainer";

const STEPS = ["Address", "Delivery", "Review & Pay"];
const PAYMENT_METHODS = [
  { id: "online", label: "Pay Online (Razorpay)", icon: "card-outline" },
  { id: "cod", label: "Cash on Delivery", icon: "cash-outline" },
];

// react-native-razorpay is a native module — it doesn't exist inside Expo
// Go, only in a custom dev client / production build. We load it lazily so
// the app still runs in Expo Go; online payment simply explains that and
// falls back to suggesting COD for testing there.
function loadRazorpayCheckout() {
  try {
    return require("react-native-razorpay").default;
  } catch {
    return null;
  }
}

export default function CheckoutScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [checkout, setCheckout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [shippingMethods, setShippingMethods] = useState([]);
  const [selectedShippingMethodId, setSelectedShippingMethodId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("online");
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [checkoutData, addressList] = await Promise.all([
          checkoutService.createCheckout(),
          addressService.fetchAddresses(),
        ]);
        setCheckout(checkoutData);
        setAddresses(addressList);
        const defaultAddr = addressList.find((a) => a.isDefaultShipping) || addressList[0];
        if (defaultAddr) setSelectedAddressId(defaultAddr._id);
      } catch (err) {
        Alert.alert("Checkout error", err?.message || "Could not start checkout", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Refresh the address list when returning from the "Add address" screen.
  useFocusEffect(
    useCallback(() => {
      addressService.fetchAddresses().then(setAddresses).catch(() => {});
    }, [])
  );

  const onContinueFromAddress = async () => {
    if (!selectedAddressId) return Alert.alert("Select an address", "Please select or add a delivery address");
    try {
      setLoading(true);
      let updated = await checkoutService.setShippingAddress(checkout.id || checkout._id, { addressId: selectedAddressId });
      updated = await checkoutService.setBillingAddress(updated.id || updated._id, { sameAsShipping: true });
      setCheckout(updated);
      const methods = await checkoutService.getShippingMethods(updated.id || updated._id);
      setShippingMethods(methods);
      if (methods[0]) setSelectedShippingMethodId(methods[0].id || methods[0]._id);
      setStep(1);
    } catch (err) {
      Alert.alert("Error", err?.message || "Could not set address");
    } finally {
      setLoading(false);
    }
  };

  const onContinueFromDelivery = async () => {
    if (!selectedShippingMethodId) return Alert.alert("Select a delivery method");
    try {
      setLoading(true);
      const updated = await checkoutService.setShippingMethod(checkout.id || checkout._id, selectedShippingMethodId);
      setCheckout(updated);
      setStep(2);
    } catch (err) {
      Alert.alert("Error", err?.message || "Could not set delivery method");
    } finally {
      setLoading(false);
    }
  };

  const onPlaceOrder = async () => {
    setPlacing(true);
    const checkoutId = checkout.id || checkout._id;
    const idempotencyKey = `${checkoutId}-${Date.now()}`;
    try {
      const result = await checkoutService.placeOrder(checkoutId, { paymentMethod, idempotencyKey });

      if (paymentMethod === "cod" || !result.razorpayOrderId) {
        dispatch(fetchCartThunk());
        return Alert.alert("Order placed!", `Order ${result.order?.orderNumber || ""} has been placed.`, [
          { text: "View Orders", onPress: () => router.replace("/orders") },
        ]);
      }

      const RazorpayCheckout = loadRazorpayCheckout();
      if (!RazorpayCheckout) {
        return Alert.alert(
          "Online payment unavailable here",
          "Card/UPI payment needs a native build (react-native-razorpay isn't available inside Expo Go). Use Cash on Delivery to test the full flow now, or run this from an EAS dev build / production build to test real payments.",
          [{ text: "OK" }]
        );
      }

      const razorpayKeyId = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;
      if (!razorpayKeyId) {
        return Alert.alert("Missing config", "EXPO_PUBLIC_RAZORPAY_KEY_ID is not set — this must match the backend's RAZORPAY_KEY_ID.");
      }

      const payment = await RazorpayCheckout.open({
        key: razorpayKeyId,
        order_id: result.razorpayOrderId,
        amount: result.amount,
        currency: "INR",
        name: "dryCatch",
      });

      const verifyResult = await orderService.verifyPayment({
        orderId: result.order.id || result.order._id,
        razorpay_order_id: payment.razorpay_order_id,
        razorpay_payment_id: payment.razorpay_payment_id,
        razorpay_signature: payment.razorpay_signature,
      });

      dispatch(fetchCartThunk());
      Alert.alert("Payment successful", `Order ${verifyResult.order?.orderNumber || ""} confirmed.`, [
        { text: "View Orders", onPress: () => router.replace("/orders") },
      ]);
    } catch (err) {
      if (err?.code === 0 || err?.description) {
        // User cancelled the Razorpay sheet — not a real error.
        return;
      }
      Alert.alert("Order failed", err?.message || err?.description || "Please try again");
    } finally {
      setPlacing(false);
    }
  };

  if (loading && !checkout) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.navy} />
      </View>
    );
  }

  const pricing = checkout?.pricing || { subtotal: 0, discount: 0, shipping: 0, tax: 0, total: 0 };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScreenContainer style={styles.stepRow}>
        {STEPS.map((label, index) => (
          <View key={label} style={styles.stepItem}>
            <View style={[styles.stepDot, index <= step && styles.stepDotActive]}>
              <Text style={[styles.stepNumber, index <= step && styles.stepNumberActive]}>{index + 1}</Text>
            </View>
            <Text style={styles.stepLabel}>{label}</Text>
          </View>
        ))}
      </ScreenContainer>

      <ScrollView contentContainerStyle={{ alignItems: "center", paddingBottom: 32 }}>
        <ScreenContainer style={{ padding: 16 }}>
        {step === 0 && (
          <View>
            <Text style={styles.sectionTitle}>Select delivery address</Text>
            {addresses.map((addr) => (
              <Pressable
                key={addr._id}
                style={[styles.addressCard, selectedAddressId === addr._id && styles.addressCardActive]}
                onPress={() => setSelectedAddressId(addr._id)}
              >
                <Ionicons
                  name={selectedAddressId === addr._id ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={COLORS.navy}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressName}>{addr.fullName}</Text>
                  <Text style={styles.addressText}>
                    {addr.addressLine1}, {addr.addressLine2 ? `${addr.addressLine2}, ` : ""}
                    {addr.city}, {addr.state} - {addr.postalCode}
                  </Text>
                  <Text style={styles.addressText}>{addr.phone}</Text>
                </View>
              </Pressable>
            ))}
            <Pressable style={styles.addAddressBtn} onPress={() => router.push("/addresses")}>
              <Ionicons name="add" size={18} color={COLORS.navy} />
              <Text style={styles.addAddressText}>Add new address</Text>
            </Pressable>
          </View>
        )}

        {step === 1 && (
          <View>
            <Text style={styles.sectionTitle}>Delivery method</Text>
            {shippingMethods.map((method) => {
              const methodId = method.id || method._id;
              return (
                <Pressable
                  key={methodId}
                  style={[styles.addressCard, selectedShippingMethodId === methodId && styles.addressCardActive]}
                  onPress={() => setSelectedShippingMethodId(methodId)}
                >
                  <Ionicons name="bicycle-outline" size={20} color={COLORS.navy} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addressName}>{method.name}</Text>
                    {method.etaDays && <Text style={styles.addressText}>{method.etaDays} business days</Text>}
                  </View>
                  <Text style={styles.deliveryPrice}>
                    {method.cost === 0 ? "Free" : formatPrice(method.cost)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.sectionTitle}>Payment method</Text>
            {PAYMENT_METHODS.map((method) => (
              <Pressable
                key={method.id}
                style={[styles.addressCard, paymentMethod === method.id && styles.addressCardActive]}
                onPress={() => setPaymentMethod(method.id)}
              >
                <Ionicons name={method.icon} size={20} color={COLORS.navy} />
                <Text style={styles.addressName}>{method.label}</Text>
              </Pressable>
            ))}

            <Text style={styles.sectionTitle}>Order summary</Text>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatPrice(pricing.subtotal)}</Text>
            </View>
            {pricing.discount > 0 && (
              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Discount</Text>
                <Text style={styles.summaryValue}>-{formatPrice(pricing.discount)}</Text>
              </View>
            )}
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Shipping</Text>
              <Text style={styles.summaryValue}>{pricing.shipping === 0 ? "Free" : formatPrice(pricing.shipping)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Tax</Text>
              <Text style={styles.summaryValue}>{formatPrice(pricing.tax)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPrice(pricing.total)}</Text>
            </View>
          </View>
        )}
        </ScreenContainer>
      </ScrollView>

      <ScreenContainer style={styles.bottomBar}>
        {step > 0 && (
          <Button title="Back" variant="outline" onPress={() => setStep((s) => s - 1)} style={{ flex: 1 }} />
        )}
        {step === 0 && <Button title="Continue" onPress={onContinueFromAddress} loading={loading} style={{ flex: 1 }} />}
        {step === 1 && <Button title="Continue" onPress={onContinueFromDelivery} loading={loading} style={{ flex: 1 }} />}
        {step === 2 && (
          <Button title={`Place Order · ${formatPrice(pricing.total)}`} onPress={onPlaceOrder} loading={placing} style={{ flex: 1 }} />
        )}
      </ScreenContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  stepRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 16 },
  stepItem: { alignItems: "center", gap: 4 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: { backgroundColor: COLORS.navy },
  stepNumber: { fontSize: 12, fontWeight: "700", color: COLORS.textSecondary },
  stepNumberActive: { color: COLORS.white },
  stepLabel: { fontSize: 10, color: COLORS.textSecondary },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: COLORS.textPrimary, marginBottom: 12, marginTop: 8 },
  addressCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    marginBottom: 10,
  },
  addressCardActive: { borderColor: COLORS.navy, backgroundColor: COLORS.surface },
  addressName: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  addressText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  addAddressBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  addAddressText: { color: COLORS.navy, fontWeight: "700", fontSize: 13 },
  deliveryPrice: { fontWeight: "800", color: COLORS.navy },
  summaryLine: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  summaryLabel: { color: COLORS.textSecondary, fontSize: 13 },
  summaryValue: { color: COLORS.textPrimary, fontSize: 13, fontWeight: "600" },
  totalLabel: { color: COLORS.textPrimary, fontSize: 16, fontWeight: "800" },
  totalValue: { color: COLORS.navy, fontSize: 16, fontWeight: "800" },
  bottomBar: { flexDirection: "row", gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
});
