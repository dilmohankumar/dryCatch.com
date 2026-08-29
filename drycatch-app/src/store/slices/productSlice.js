import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as productService from "../../services/productService";

export const fetchProductsThunk = createAsyncThunk("products/fetchAll", async (params) =>
  productService.fetchProducts(params)
);

export const fetchCategoriesThunk = createAsyncThunk("products/fetchCategories", async () =>
  productService.fetchCategories()
);

export const fetchFeaturedThunk = createAsyncThunk("products/fetchFeatured", async () =>
  productService.fetchFeaturedProducts()
);

const initialState = {
  items: [],
  pagination: null,
  categories: [],
  featured: [],
  status: "idle",
  error: null,
};

const productSlice = createSlice({
  name: "products",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProductsThunk.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchProductsThunk.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.items = action.payload.items;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchProductsThunk.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error?.message || "Failed to load products";
      })
      .addCase(fetchCategoriesThunk.fulfilled, (state, action) => {
        state.categories = action.payload;
      })
      .addCase(fetchFeaturedThunk.fulfilled, (state, action) => {
        state.featured = action.payload;
      });
  },
});

export default productSlice.reducer;
