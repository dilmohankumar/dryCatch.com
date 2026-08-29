import axios from "axios";
import * as SecureStore from "expo-secure-store";

// The backend has no path/header for selecting a tenant — it resolves the
// tenant from the HTTP Host header, or falls back to a default tenant when
// nothing matches (see drycatch-backend/src/middleware/tenantContext.js).
// For local dev this just needs to point at the machine running the API:
//   - iOS simulator: http://localhost:5000/api/v1 works (shares host loopback)
//   - Android emulator: use http://10.0.2.2:5000/api/v1 instead of localhost
//   - a physical phone (Expo Go): use your computer's LAN IP, e.g.
//     http://192.168.1.23:5000/api/v1 — set EXPO_PUBLIC_API_URL to override.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api/v1";

const ACCESS_TOKEN_KEY = "drycatch_access_token";
const REFRESH_TOKEN_KEY = "drycatch_refresh_token";

export const tokenStorage = {
  async getAccessToken() {
    try {
      return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    } catch {
      return null;
    }
  },
  async getRefreshToken() {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  },
  async setTokens({ accessToken, refreshToken }) {
    try {
      if (accessToken) await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      if (refreshToken) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    } catch {}
  },
  async clear() {
    try {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } catch {}
  },
};

const api = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });

api.interceptors.request.use(async (config) => {
  const token = await tokenStorage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Refreshes once on a 401 using the stored refresh token, then retries the
// original request. If the refresh itself fails, tokens are cleared and the
// caller sees the original 401 — the UI (authSlice) treats that as "logged out".
let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error?.response?.status;

    if (status === 401 && !original?._retry && !original?.url?.includes("/auth/")) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = (async () => {
            const refreshToken = await tokenStorage.getRefreshToken();
            if (!refreshToken) throw new Error("No refresh token");
            const { data } = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
            await tokenStorage.setTokens(data);
            return data.accessToken;
          })().finally(() => {
            refreshPromise = null;
          });
        }
        const newAccessToken = await refreshPromise;
        original.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(original);
      } catch {
        await tokenStorage.clear();
      }
    }

    return Promise.reject(error?.response?.data || { message: error.message });
  }
);

export default api;
