import { useEffect } from "react";
import { Platform, View } from "react-native";
import "./src/global.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./src/lib/queryClient";
import AppNavigator from "./src/navigation/AppNavigator";
import SandboxWebView from "./src/components/SandboxWebView";
import { ProviderManager } from "./src/services/ProviderManager";

export default function App() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    // Sync the persisted provider store with what's actually on disk and
    // re-download the active bundle if it's missing.
    ProviderManager.reconcileProviderStore().catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <View style={{ flex: 1 }}>
        <AppNavigator />
        <SandboxWebView />
      </View>
    </QueryClientProvider>
  );
}
