import { useEffect } from "react";
import { Provider, useDispatch } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";

import { store, persistor } from "../src/store";
import { restoreSessionThunk } from "../src/store/slices/authSlice";

function SessionBootstrap() {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(restoreSessionThunk());
  }, [dispatch]);
  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <SafeAreaProvider>
            <SessionBootstrap />
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="product/[id]" options={{ headerShown: true, title: "" }} />
              <Stack.Screen name="search/index" options={{ headerShown: true, title: "Search" }} />
              <Stack.Screen name="checkout/index" options={{ headerShown: true, title: "Checkout" }} />
              <Stack.Screen name="orders/index" options={{ headerShown: true, title: "My Orders" }} />
              <Stack.Screen name="orders/[id]" options={{ headerShown: true, title: "Order Details" }} />
              <Stack.Screen name="addresses/index" options={{ headerShown: true, title: "Addresses" }} />
            </Stack>
          </SafeAreaProvider>
        </PersistGate>
      </Provider>
    </GestureHandlerRootView>
  );
}
