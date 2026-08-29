import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as cartService from "../../services/cartService";

export const fetchCartThunk = createAsyncThunk("cart/fetch", async () => cartService.fetchCart());

export const addCartItemThunk = createAsyncThunk("cart/addItem", async ({ variantId, quantity }) =>
  cartService.addCartItem({ variantId, quantity })
);

export const updateCartItemThunk = createAsyncThunk("cart/updateItem", async ({ itemId, quantity }) =>
  cartService.updateCartItem({ itemId, quantity })
);

export const removeCartItemThunk = createAsyncThunk("cart/removeItem", async ({ itemId }) =>
  cartService.removeCartItem({ itemId })
);

export const clearCartThunk = createAsyncThunk("cart/clear", async () => cartService.clearCart());

const initialState = {
  cartId: null,
  items: [],
  summary: { subtotal: 0, discount: 0, tax: 0, shipping: null, total: 0, currency: "INR" },
  status: "idle",
  error: null,
};

function applyCart(state, cart) {
  state.cartId = cart.cartId;
  state.items = cart.items;
  state.summary = cart.summary;
}

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    resetCart: () => initialState,
  },
  extraReducers: (builder) => {
    builder.addMatcher(
      (action) => action.type.startsWith("cart/") && action.type.endsWith("/pending"),
      (state) => {
        state.status = "loading";
        state.error = null;
      }
    );
    builder.addMatcher(
      (action) => action.type.startsWith("cart/") && action.type.endsWith("/fulfilled"),
      (state, action) => {
        state.status = "succeeded";
        applyCart(state, action.payload);
      }
    );
    builder.addMatcher(
      (action) => action.type.startsWith("cart/") && action.type.endsWith("/rejected"),
      (state, action) => {
        state.status = "failed";
        state.error = action.error?.message || "Cart action failed";
      }
    );
  },
});

export const { resetCart } = cartSlice.actions;
export default cartSlice.reducer;

export const selectCartCount = (state) => state.cart.items.reduce((sum, i) => sum + i.quantity, 0);
