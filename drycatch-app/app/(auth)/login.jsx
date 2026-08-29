import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Link } from "expo-router";
import { useDispatch, useSelector } from "react-redux";

import { COLORS, RADIUS } from "../../src/constants/theme";
import Logo from "../../src/components/common/Logo";
import Button from "../../src/components/common/Button";
import ScreenContainer from "../../src/components/common/ScreenContainer";
import { loginThunk, clearAuthError } from "../../src/store/slices/authSlice";

export default function LoginScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { status, error } = useSelector((state) => state.auth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async () => {
    dispatch(clearAuthError());
    const result = await dispatch(loginThunk({ email, password }));
    if (loginThunk.fulfilled.match(result)) {
      router.replace("/(tabs)/home");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "center" }}
      >
        <ScreenContainer style={styles.content}>
          <Logo size={28} />
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Login to continue shopping fresh, sun-dried catch</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Login" onPress={onSubmit} loading={status === "loading"} style={{ marginTop: 8 }} />

          <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/register" asChild>
              <Pressable>
                <Text style={styles.footerLink}>Register</Text>
              </Pressable>
            </Link>
          </View>
        </ScreenContainer>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: "800", color: COLORS.textPrimary, marginTop: 24 },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 12 },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  error: { color: COLORS.error, fontSize: 12 },
  link: { color: COLORS.navy, fontWeight: "600", fontSize: 13, textAlign: "center", marginTop: 16 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { color: COLORS.textSecondary, fontSize: 13 },
  footerLink: { color: COLORS.navy, fontWeight: "700", fontSize: 13 },
});
