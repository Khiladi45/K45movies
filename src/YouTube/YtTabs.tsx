import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import UserSettings from "@/components/settings";
import AddProviders from "@/components/providersAdd";
import YtBottomBar from "./components/YtBottomBar";
import YtHomeScreen from "./screens/YtHomeScreen";
import YtShortsScreen from "./screens/YtShortsScreen";
import YtSearchScreen from "./screens/YtSearchScreen";
import YtWatchlistScreen from "./screens/YtWatchlistScreen";

const Tab = createBottomTabNavigator();

/**
 * The tab navigator used while Settings → Layout is "YouTube Layout".
 *
 * The bar shows Home, Shorts, Search and Watchlist. Profile (Settings) and
 * Providers stay registered so the Home header can open Settings and the user
 * can always switch the layout back, but they have no tab button.
 */
export default function YtTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <YtBottomBar {...props} />}
      screenOptions={{ headerShown: false }}
      initialRouteName="HomeTab"
      backBehavior="initialRoute"
    >
      <Tab.Screen name="HomeTab" component={YtHomeScreen} />
      <Tab.Screen name="Shorts" component={YtShortsScreen} />
      <Tab.Screen name="Search" component={YtSearchScreen} />
      <Tab.Screen name="Watchlist" component={YtWatchlistScreen} />
      <Tab.Screen name="Profile" component={UserSettings} />
      <Tab.Screen name="Providers" component={AddProviders} />
    </Tab.Navigator>
  );
}
