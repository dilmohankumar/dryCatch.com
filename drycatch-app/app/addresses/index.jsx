import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { COLORS, RADIUS } from "../../src/constants/theme";
import Button from "../../src/components/common/Button";
import EmptyState from "../../src/components/common/EmptyState";
import ScreenContainer from "../../src/components/common/ScreenContainer";
import { useResponsive } from "../../src/hooks/useResponsive";
import * as addressService from "../../src/services/addressService";

const EMPTY_FORM = {
  fullName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
};

export default function AddressesScreen() {
  const { gridColumns } = useResponsive();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    addressService
      .fetchAddresses()
      .then(setAddresses)
      .catch((err) => Alert.alert("Error", err?.message || "Failed to load addresses"))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  const onSave = async () => {
    if (!form.fullName || !form.addressLine1 || !form.city || !form.state || !form.postalCode || !form.phone) {
      return Alert.alert("Missing fields", "Please fill in all required fields");
    }
    setSaving(true);
    try {
      await addressService.createAddress(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      Alert.alert("Error", err?.message || "Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (id) => {
    Alert.alert("Delete address", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await addressService.deleteAddress(id).catch((err) => Alert.alert("Error", err?.message));
          load();
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

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      {showForm ? (
        <ScreenContainer style={{ padding: 16, gap: 10 }} containerStyle={{ flex: 1 }}>
          <TextInput style={styles.input} placeholder="Full name" value={form.fullName} onChangeText={(v) => setForm({ ...form, fullName: v })} />
          <TextInput style={styles.input} placeholder="Phone" keyboardType="phone-pad" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} />
          <TextInput style={styles.input} placeholder="Address line 1" value={form.addressLine1} onChangeText={(v) => setForm({ ...form, addressLine1: v })} />
          <TextInput style={styles.input} placeholder="Address line 2 (optional)" value={form.addressLine2} onChangeText={(v) => setForm({ ...form, addressLine2: v })} />
          <TextInput style={styles.input} placeholder="City" value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} />
          <TextInput style={styles.input} placeholder="State" value={form.state} onChangeText={(v) => setForm({ ...form, state: v })} />
          <TextInput style={styles.input} placeholder="Postal code" keyboardType="number-pad" value={form.postalCode} onChangeText={(v) => setForm({ ...form, postalCode: v })} />
          <Button title="Save Address" onPress={onSave} loading={saving} />
          <Button title="Cancel" variant="outline" onPress={() => setShowForm(false)} />
        </ScreenContainer>
      ) : (
        <ScreenContainer style={{ flex: 1 }} containerStyle={{ flex: 1 }}>
          <FlatList
            key={gridColumns >= 3 ? "wide" : "narrow"}
            data={addresses}
            keyExtractor={(item) => item._id}
            numColumns={gridColumns >= 3 ? 2 : 1}
            columnWrapperStyle={gridColumns >= 3 ? { gap: 12 } : undefined}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            ListEmptyComponent={<EmptyState icon="location-outline" title="No addresses saved" subtitle="Add one to speed up checkout" />}
            renderItem={({ item }) => (
              <View style={[styles.card, gridColumns >= 3 && { flex: 1 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.fullName}</Text>
                  <Text style={styles.text}>
                    {item.addressLine1}, {item.addressLine2 ? `${item.addressLine2}, ` : ""}
                    {item.city}, {item.state} - {item.postalCode}
                  </Text>
                  <Text style={styles.text}>{item.phone}</Text>
                  {item.isDefaultShipping && <Text style={styles.defaultTag}>Default</Text>}
                </View>
                <Pressable onPress={() => onDelete(item._id)}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                </Pressable>
              </View>
            )}
          />
          <View style={{ padding: 16 }}>
            <Button title="Add New Address" onPress={() => setShowForm(true)} />
          </View>
        </ScreenContainer>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
  },
  name: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  text: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  defaultTag: { fontSize: 11, fontWeight: "700", color: COLORS.navy, marginTop: 4 },
});
