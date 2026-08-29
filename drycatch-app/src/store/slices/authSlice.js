import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as authService from "../../services/authService";
import { resetCart } from "./cartSlice";
import { resetWishlist } from "./wishlistSlice";

export const loginThunk = createAsyncThunk("auth/login", async (payload) => authService.login(payload));

export const signupThunk = createAsyncThunk("auth/signup", async (payload) => authService.signup(payload));

export const verifySignupOtpThunk = createAsyncThunk("auth/verifySignupOtp", async (payload) =>
  authService.verifySignupOtp(payload)
);

export const restoreSessionThunk = createAsyncThunk("auth/restore", async () => authService.restoreSession());

export const logoutThunk = createAsyncThunk("auth/logout", async (_, { dispatch }) => {
  await authService.logout();
  dispatch(resetCart());
  dispatch(resetWishlist());
  return null;
});

const initialState = {
  user: null,
  isAuthenticated: false,
  status: "idle",
  error: null,
  hasRestored: false,
  pendingSignupEmail: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearAuthError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload.user;
        state.isAuthenticated = true;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error?.message || "Login failed";
      })
      .addCase(signupThunk.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(signupThunk.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.pendingSignupEmail = action.payload.email;
      })
      .addCase(signupThunk.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error?.message || "Registration failed";
      })
      .addCase(verifySignupOtpThunk.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(verifySignupOtpThunk.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.pendingSignupEmail = null;
      })
      .addCase(verifySignupOtpThunk.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error?.message || "Verification failed";
      })
      .addCase(restoreSessionThunk.fulfilled, (state, action) => {
        state.hasRestored = true;
        if (action.payload) {
          state.user = action.payload.user;
          state.isAuthenticated = true;
        }
      })
      .addCase(restoreSessionThunk.rejected, (state) => {
        state.hasRestored = true;
      })
      .addCase(logoutThunk.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
      });
  },
});

export const { clearAuthError } = authSlice.actions;
export default authSlice.reducer;
