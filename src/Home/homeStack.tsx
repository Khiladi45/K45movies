import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeScreen from "./screens/HomeScreen";
import DetailScreen from "./screens/DetailScreen";
import Header from "@/components/header";

const Stack = createNativeStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="HomeScreen"
        component={HomeScreen}
        options={{
          header: () => <Header />,
        }}
      />
    </Stack.Navigator>
  );
}
