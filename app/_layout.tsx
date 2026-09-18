import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "../src/store";
export default function Layout() {
  return (
    <SafeAreaProvider>
      <Provider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{ headerShown: false, animation: "slide_from_right" }}
        />
      </Provider>
    </SafeAreaProvider>
  );
}
