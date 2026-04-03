import "../global.css";

import { Stack } from "expo-router";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import RayaAssistant from "../components/UI/RayaAssistant";
import { AppStateProvider } from "../lib/app-state";

export default function RootLayout() {
  return (
    <SafeAreaView style={styles.container}>
      <AppStateProvider>
        <GestureHandlerRootView style={styles.container}>
          <Stack initialRouteName="index">
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="email-signin" options={{ headerShown: false }} />
            <Stack.Screen name="email-signup" options={{ headerShown: false }} />
            <Stack.Screen name="complete-profile" options={{ headerShown: false }} />
            <Stack.Screen name="movies" options={{ headerShown: false }} />
            <Stack.Screen name="library" options={{ headerShown: false }} />
            <Stack.Screen name="profile" options={{ headerShown: false }} />
          </Stack>
          <RayaAssistant />
        </GestureHandlerRootView>
      </AppStateProvider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});


