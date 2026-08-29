import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as wishlistService from "../../services/wishlistService";

export const fetchWishlistThunk = createAsyncThunk("wishlist/fetch", async () => wishlistService.fetchWishlist());

export const addToWishlistThunk = createAsyncThunk("wishlist/add", async (productId) =>
  wishlistService.addToWishlist(productId)
);

export const removeFromWishlistThunk = createAsyncThunk("wishlist/remove", async (productId) =>
  wishlistService.removeFromWishlist(productId)
);

const initialState = {
  items: [],
  status: "idle",
  error: null,
};

const wishlistSlice = createSlice({
  name: "wishlist",
  initialState,
  reducers: {
    resetWishlist: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWishlistThunk.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchWishlistThunk.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.items = action.payload;
      })
      .addCase(fetchWishlistThunk.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error?.message || "Failed to load wishlist";
      })
      .addCase(addToWishlistThunk.fulfilled, (state, action) => {
        state.items = action.payload;
      })
      .addCase(removeFromWishlistThunk.fulfilled, (state, action) => {
        state.items = action.payload;
      });
  },
});

export const { resetWishlist } = wishlistSlice.actions;
export default wishlistSlice.reducer;

export const selectIsWishlisted = (state, productId) => state.wishlist.items.some((p) => p.id === productId);
