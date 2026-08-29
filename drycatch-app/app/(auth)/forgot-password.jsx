import { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { COLORS, RADIUS } from "../../src/constants/theme";
import Button from "../../src/components/common/Button";
import ScreenContainer from "../../src/components/common/ScreenContainer";
import { requestPasswordReset, resetPassword } from "../../src/services/authService";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState("request"); // "request" | "reset"
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onRequest = async () => {
    setLoading(true);
    try {
      await requestPasswordReset({ email });
      setStep("reset");
    } catch (err) {
      Alert.alert("Error", err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const onReset = async () => {
    setLoading(true);
    try {
      await resetPassword({ email, otp, newPassword });
      Alert.alert("Password reset", "You can now login with your new password.", [
        { text: "Login", onPress: () => router.replace("/(auth)/login") },
      ]);
    } catch (err) {
      Alert.alert("Error", err?.message || "Invalid or expired OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { justifyContent: "center" }]}>
      <ScreenContainer style={styles.content}>
        <Text style={styles.title}>Reset your password</Text>

        {step === "request" ? (
          <>
            <Text style={styles.subtitle}>Enter your email and we'll send you an OTP</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Button title="Send OTP" onPress={onRequest} loading={loading} style={{ marginTop: 8 }} />
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>Enter the OTP sent to {email} and your new password</Text>
            <TextInput
              style={styles.input}
              placeholder="OTP"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
            />
            <TextInput
              style={styles.input}
              placeholder="New password"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <Button title="Reset Password" onPress={onReset} loading={loading} style={{ marginTop: 8 }} />
          </>
        )}

        <Button title="Back to Login" variant="outline" onPress={() => router.back()} style={{ marginTop: 12 }} />
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
    fontSize: 14,
  },
});
