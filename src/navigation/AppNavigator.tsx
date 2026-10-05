import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import BottomTabs from "./footer";
import ThemeSettingsScreen from "@/Tools/ThemeSettingsScreen";
import DetailScreen from "@/Home/screens/DetailScreen";
import SearchResults from "@/Tools/SearchResults";
import PlayerScreen from "@/Home/screens/PlayerScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
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
            animation: "slide_from_right", // Slides in from the left
          }}
        />

        <Stack.Screen name="SearchResults" component={SearchResults} />

        <Stack.Screen
          name="Detail"
          component={DetailScreen}
          options={{
            title: "Movie Details",
          }}
        />

        <Stack.Screen
          name="Player"
          component={PlayerScreen}
          options={{
            title: "Player",
          }}
        />

        {/* Later */}
        {/* <Stack.Screen name="Settings" component={SettingsScreen} /> */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
