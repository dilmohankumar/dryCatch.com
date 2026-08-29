import { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";

import { COLORS, RADIUS } from "../../src/constants/theme";
import Button from "../../src/components/common/Button";
import ScreenContainer from "../../src/components/common/ScreenContainer";
import { verifySignupOtpThunk, clearAuthError } from "../../src/store/slices/authSlice";

export default function VerifyOtpScreen() {
  const { email } = useLocalSearchParams();
  const router = useRouter();
  const dispatch = useDispatch();
  const { status, error } = useSelector((state) => state.auth);
  const [otp, setOtp] = useState("");

  const onSubmit = async () => {
    dispatch(clearAuthError());
    const result = await dispatch(verifySignupOtpThunk({ email, otp }));
    if (verifySignupOtpThunk.fulfilled.match(result)) {
      router.replace("/(tabs)/home");
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { justifyContent: "center" }]}>
      <ScreenContainer style={styles.content}>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>Enter the OTP sent to {email}</Text>

        <TextInput
          style={styles.input}
          placeholder="6-digit OTP"
          keyboardType="number-pad"
          maxLength={6}
          value={otp}
          onChangeText={setOtp}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title="Verify & Continue" onPress={onSubmit} loading={status === "loading"} style={{ marginTop: 8 }} />
      </ScreenContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: "800", color: COLORS.textPrimary },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 12 },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    fontSize: 18,
    textAlign: "center",
    letterSpacing: 4,
  },
  error: { color: COLORS.error, fontSize: 12 },
});
