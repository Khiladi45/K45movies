// Root of the Android TV interface (Movie Based layout only). Uses the app's
// shared navigationRef, so the player, resume and failover code that call
// navigate("Player") / goBack() work unchanged.
import React, { useCallback, useRef, useState } from "react";
import { Alert, BackHandler, StyleSheet, View } from "react-native";
import {
  DarkTheme,
  NavigationContainer,
  useFocusEffect,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { navigationRef } from "@/navigation/navigationRef";
import PlayerScreen from "@/Home/screens/PlayerScreen";
import SideNav, { type TvSection } from "./components/SideNav";
import TvHomeScreen from "./screens/TvHomeScreen";
import TvSearchScreen from "./screens/TvSearchScreen";
import TvMyListScreen from "./screens/TvMyListScreen";
import TvSettingsScreen from "./screens/TvSettingsScreen";
import TvDetailScreen from "./screens/TvDetailScreen";
import { TV } from "./theme";
import { useRestoreTvFocus } from "./useRestoreTvFocus";
import TvLayoutShell from "./shell/TvLayoutShell";
import TvCategoryScreen from "./provider/TvCategoryScreen";
import TvProviderDetailScreen from "./provider/TvProviderDetailScreen";
import TvYtPlaceholder from "./youtube/TvYtPlaceholder";

const Stack = createNativeStackNavigator();

function TvMain() {
  const [section, setSection] = useState<TvSection>("home");
  const activeNavRef = useRef<View | null>(null);
  // Back from a title page or the player: focus returns to where it was.
  useRestoreTvFocus(activeNavRef);

  // Back: from another section return Home; on Home ask before leaving.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (section !== "home") {
          setSection("home");
          return true;
        }
        Alert.alert("Exit K45movies?", undefined, [
          { text: "Cancel", style: "cancel" },
          { text: "Exit", style: "destructive", onPress: () => BackHandler.exitApp() },
        ]);
        return true;
      });
      return () => sub.remove();
    }, [section]),
  );

  return (
    <View style={styles.main}>
      <SideNav section={section} onSelect={setSection} activeRef={activeNavRef} />
      <View style={styles.content}>
        {section === "home" ? <TvHomeScreen /> : null}
        {section === "search" ? <TvSearchScreen /> : null}
        {section === "mylist" ? <TvMyListScreen /> : null}
        {section === "settings" ? <TvSettingsScreen /> : null}
      </View>
    </View>
  );
}

/**
 * TvMain route: the layout chosen in Settings. Movie Based is the TvMain above,
 * unchanged; Provider Based and YouTube have their own shells.
 */
function TvLayoutRoot() {
  return <TvLayoutShell MovieShell={TvMain} />;
}

export default function TvApp() {
  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: TV.bg } }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: TV.bg },
          animation: "fade",
        }}
      >
        <Stack.Screen name="TvMain" component={TvLayoutRoot} />
        <Stack.Screen name="TmdbDetail" component={TvDetailScreen} />
        <Stack.Screen name="Player" component={PlayerScreen} />
        {/* Provider Based layout (TV-only routes). */}
        <Stack.Screen name="TvCategory" component={TvCategoryScreen} />
        <Stack.Screen name="TvProviderDetail" component={TvProviderDetailScreen} />
        {/* YouTube layout (TV-only routes). */}
        <Stack.Screen name="TvYtVideo" component={TvYtPlaceholder} />
        <Stack.Screen name="TvYtShorts" component={TvYtPlaceholder} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, flexDirection: "row", backgroundColor: TV.bg },
  content: { flex: 1 },
});
