import { View, Text, Pressable, StyleSheet } from "react-native";
import { useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS } from "../../constants/theme";
import { formatPrice } from "../../utils/currency";
import ProductImage from "../product/ProductImage";
import { updateCartItemThunk, removeCartItemThunk } from "../../store/slices/cartSlice";

const AVAILABILITY_LABEL = {
  LOW_STOCK: "Only a few left",
  INSUFFICIENT_STOCK: "Not enough stock for this quantity",
  OUT_OF_STOCK: "Out of stock",
  PRODUCT_UNAVAILABLE: "No longer available",
  VARIANT_UNAVAILABLE: "This size is no longer available",
};

export default function CartItem({ item }) { 
  const dispatch = useDispatch();
  const warning = AVAILABILITY_LABEL[item.availability];

  return (
    <View style={styles.row}>
      <ProductImage images={item.image ? [item.image] : []} emoji="🐟" style={styles.image} emojiSize={22} />
      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.name}>
          {item.productName}
        </Text>
        <Text style={styles.variant}>{item.variantLabel}</Text>
        <Text style={styles.price}>{formatPrice(item.unitPrice)}</Text>
        {warning && <Text style={styles.warning}>{warning}</Text>}
      </View>
      <View style={styles.actions}>
        <Pressable onPress={() => dispatch(removeCartItemThunk({ itemId: item.id }))} style={styles.removeBtn}>
          <Ionicons name="trash-outline" size={16} color={COLORS.error} />
        </Pressable>
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepBtn}
            onPress={() =>
              item.quantity <= 1
                ? dispatch(removeCartItemThunk({ itemId: item.id }))
                : dispatch(updateCartItemThunk({ itemId: item.id, quantity: item.quantity - 1 }))
            }
          >
            <Ionicons name="remove" size={16} color={COLORS.navy} />
          </Pressable>
          <Text style={styles.qty}>{item.quantity}</Text>
          <Pressable
            style={styles.stepBtn}
            disabled={item.maxAvailable != null && item.quantity >= item.maxAvailable}
            onPress={() => dispatch(updateCartItemThunk({ itemId: item.id, quantity: item.quantity + 1 }))}
          >
            <Ionicons name="add" size={16} color={COLORS.navy} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", padding: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  image: { width: 64, height: 64 },
  info: { flex: 1, justifyContent: "center" },
  name: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  variant: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  price: { fontSize: 14, fontWeight: "800", color: COLORS.navy, marginTop: 4 },
  warning: { fontSize: 11, color: COLORS.error, marginTop: 2, fontWeight: "600" },
  actions: { alignItems: "flex-end", justifyContent: "space-between" },
  removeBtn: { padding: 4 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
  },
  stepBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  qty: { minWidth: 20, textAlign: "center", fontWeight: "700", color: COLORS.textPrimary },
});
