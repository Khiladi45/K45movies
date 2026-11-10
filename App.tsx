import { useEffect } from "react";
import { Platform, View } from "react-native";
import "./src/global.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as ScreenOrientation from "expo-screen-orientation";
import { queryClient } from "./src/lib/queryClient";
import AppNavigator from "./src/navigation/AppNavigator";
import SandboxWebView from "./src/components/SandboxWebView";
import PlayerOverlay from "./src/player/PlayerOverlay";
import { usePlayerStore } from "./src/store/usePlayerStore";
import { ProviderManager } from "./src/services/ProviderManager";
import { IS_TV } from "./src/TV/isTV";
import TvApp from "./src/TV/TvApp";

export default function App() {
  const sessionId = usePlayerStore((s) => s.sessionId);

  useEffect(() => {
    if (Platform.OS === "web") return;
    // Sync the persisted provider store with what's actually on disk and
    // re-download the active bundle if it's missing.
    ProviderManager.reconcileProviderStore().catch(() => {});
  }, []);

  useEffect(() => {
    // TVs are always landscape; never lock them to portrait.
    if (Platform.OS === "web" || IS_TV) return;
    // The app is portrait outside the player. The player unlocks rotation
    // itself; this also restores portrait after the player closes.
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    ).catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <View style={{ flex: 1 }}>
          {IS_TV ? <TvApp /> : <AppNavigator />}
          <SandboxWebView />
          <PlayerOverlay key={sessionId} />
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
