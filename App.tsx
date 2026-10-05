import { View } from "react-native";
import "./src/global.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./src/lib/queryClient";
import AppNavigator from "./src/navigation/AppNavigator";
import SandboxWebView from "./src/components/SandboxWebView";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <View style={{ flex: 1 }}>
        <AppNavigator />
        <SandboxWebView />
      </View>
    </QueryClientProvider>
  );
}
