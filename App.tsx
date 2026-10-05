import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import "./src/global.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./src/lib/queryClient";
import AppNavigator from "./src/navigation/AppNavigator";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppNavigator />
    </QueryClientProvider>
  );
}
