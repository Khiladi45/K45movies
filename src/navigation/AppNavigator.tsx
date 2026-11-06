import React, { useState } from "react";
import { View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import BottomTabs from "./footer";
import { navigationRef } from "./navigationRef";
import ThemeSettingsScreen from "@/Tools/ThemeSettingsScreen";
import DetailScreen from "@/Home/screens/DetailScreen";
import SearchResults from "@/Tools/SearchResults";
import PlayerScreen from "@/Home/screens/PlayerScreen";
import DownloadsScreen from "@/Home/screens/DownloadsScreen";
import CategoryScreen from "@/Home/screens/CategoryScreen";
import PreferencesScreen from "@/Tools/PreferencesScreen";
import ProviderDiagnosticsScreen from "@/Tools/ProviderDiagnosticsScreen";
import TmdbDetailScreen from "@/Tmdb/screens/TmdbDetailScreen";
import YtVideoScreen from "@/YouTube/screens/YtVideoScreen";
import YtSearchScreen from "@/YouTube/screens/YtSearchScreen";
import YtOverlays from "@/YouTube/components/YtOverlays";
import { useLayoutStore } from "@/store/useLayoutStore";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const youtube = useLayoutStore((s) => s.layout === "youtube");
  const [routeName, setRouteName] = useState<string | undefined>();
  const syncRoute = () => setRouteName(navigationRef.getCurrentRoute()?.name);
  return (
    <View style={{ flex: 1 }}>
    <NavigationContainer ref={navigationRef} onReady={syncRoute} onStateChange={syncRoute}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: "#141414",
          },
        }}
      >
        <Stack.Screen name="Tabs" component={BottomTabs} />
        <Stack.Screen
          name="ThemeSettings"
          component={ThemeSettingsScreen}
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />

        <Stack.Screen name="SearchResults" component={SearchResults} />

        <Stack.Screen
          name="Detail"
          component={DetailScreen}
          options={{
            title: "Movie Details",
            animation: "slide_from_bottom",
          }}
        />

        {/* Movie Based layout only: TMDB movie / series details */}
        <Stack.Screen
          name="TmdbDetail"
          component={TmdbDetailScreen}
          options={{
            title: "Details",
            animation: "slide_from_bottom",
          }}
        />

        {/* YouTube layout only: search (suggestions + results) */}
        <Stack.Screen
          name="YtSearch"
          component={YtSearchScreen}
          options={{ animation: "slide_from_right" }}
        />

        {/* YouTube layout only: video page with player and related videos */}
        <Stack.Screen
          name="YtVideo"
          component={YtVideoScreen}
          options={{
            title: "Video",
            animation: "slide_from_bottom",
          }}
        />

        <Stack.Screen
          name="Player"
          component={PlayerScreen}
          options={{
            title: "Player",
            animation: "fade",
          }}
        />

        <Stack.Screen
          name="Downloads"
          component={DownloadsScreen}
          options={{
            title: "Downloads",
            animation: "slide_from_right",
          }}
        />

        <Stack.Screen
          name="Category"
          component={CategoryScreen}
          options={{
            title: "Category",
            animation: "slide_from_right",
          }}
        />

        <Stack.Screen
          name="Preferences"
          component={PreferencesScreen}
          options={{
            title: "Preferences",
            animation: "slide_from_right",
          }}
        />

        <Stack.Screen
          name="ProviderDiagnostics"
          component={ProviderDiagnosticsScreen}
          options={{
            title: "Provider diagnostics",
            animation: "slide_from_right",
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
    {youtube ? <YtOverlays routeName={routeName} /> : null}
    </View>
  );
}
