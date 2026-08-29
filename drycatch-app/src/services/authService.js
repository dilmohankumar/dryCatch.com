import api, { tokenStorage } from "./api";

export async function signup({ firstName, lastName, email, phone, password, confirmPassword, referralCode }) {
  const { data } = await api.post("/auth/signup", {
    firstName,
    lastName,
    email,
    phone,
    password,
    confirmPassword,
    referralCode,
  });
  return data; // { message, email } — caller must verify OTP next
}

export async function verifySignupOtp({ email, otp }) {
  const { data } = await api.post("/auth/signup/verify-otp", { email, otp });
  await tokenStorage.setTokens(data);
  return data; // { user, accessToken, refreshToken }
}

export async function login({ email, phone, password }) {
  const { data } = await api.post("/auth/login", { email, phone, password });
  await tokenStorage.setTokens(data);
  return data; // { user, accessToken, refreshToken }
}

export async function requestPasswordReset({ email }) {
  const { data } = await api.post("/auth/password-reset/request", { email });
  return data;
}

export async function resetPassword({ email, otp, newPassword }) {
  const { data } = await api.post("/auth/password-reset/verify-otp", { email, otp, newPassword });
  return data;
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } finally {
    await tokenStorage.clear();
  }
}

export async function restoreSession() {
  const token = await tokenStorage.getAccessToken();
  if (!token) return null;
  const { data } = await api.get("/auth/me");
  return { user: data.user };
}

export async function updateProfile({ firstName, lastName, phone }) {
  const { data } = await api.put("/auth/profile", { firstName, lastName, phone });
  return data.user;
}

export async function changePassword({ currentPassword, newPassword }) {
  const { data } = await api.put("/auth/change-password", { currentPassword, newPassword });
  return data;
}
