import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import DetailScreen from "./screens/DetailScreen";
import { HomeGate, HomeHeaderGate } from "@/Tmdb/LayoutGates";

const Stack = createNativeStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="HomeScreen"
        component={HomeGate}
        options={{
          header: () => <HomeHeaderGate />,
        }}
      />
    </Stack.Navigator>
  );
}
