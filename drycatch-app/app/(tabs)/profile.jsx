import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";

import { COLORS, RADIUS } from "../../src/constants/theme";
import { logoutThunk } from "../../src/store/slices/authSlice";

const MENU = [
  { key: "orders", label: "My Orders", icon: "receipt-outline", href: "/orders" },
  { key: "addresses", label: "Addresses", icon: "location-outline", href: "/addresses" },
  { key: "wishlist", label: "Wishlist", icon: "heart-outline", href: "/(tabs)/wishlist" },
];

export default function ProfileScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useSelector((state) => state.auth);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.guestBox}>
          <Ionicons name="person-circle-outline" size={64} color={COLORS.textSecondary} />
          <Text style={styles.guestTitle}>Sign in to dryCatch</Text>
          <Text style={styles.guestSubtitle}>Track orders, save your wishlist and checkout faster</Text>
          <Pressable style={styles.loginBtn} onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.loginBtnText}>Login / Register</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.[0] || "U"}</Text>
        </View>
        <View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
      </View>

      <View style={styles.menu}>
        {MENU.map((item) => (
          <Pressable key={item.key} style={styles.menuItem} onPress={() => item.href && router.push(item.href)}>
            <Ionicons name={item.icon} size={20} color={COLORS.navy} />
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.logoutBtn} onPress={() => dispatch(logoutThunk())}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  guestBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 6 },
  guestTitle: { fontSize: 18, fontWeight: "800", color: COLORS.textPrimary, marginTop: 8 },
  guestSubtitle: { fontSize: 13, color: COLORS.textSecondary, textAlign: "center" },
  loginBtn: { marginTop: 16, backgroundColor: COLORS.navy, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.md },
  loginBtnText: { color: COLORS.white, fontWeight: "700" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.amber, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 22, fontWeight: "800", color: COLORS.white },
  name: { fontSize: 16, fontWeight: "800", color: COLORS.textPrimary },
  email: { fontSize: 13, color: COLORS.textSecondary },
  menu: { marginTop: 8 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: COLORS.textPrimary },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  logoutText: { color: COLORS.error, fontWeight: "700" },
});
