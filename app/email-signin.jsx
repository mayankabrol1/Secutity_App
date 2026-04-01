import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";

import AppButton from "../components/UI/AppButton";
import AppInput from "../components/UI/AppInput";
import AppKeyboardView from "../components/UI/AppKeyboardView";
import { useAppState } from "../lib/app-state";

export default function EmailSigninScreen() {
  const router = useRouter();
  const { currentUser, loginWithPassword, authLoading } = useAppState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (currentUser) return <Redirect href="/movies" />;

  async function onSignin() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      Alert.alert("Missing Info", "Email and password are required.");
      return;
    }
    try {
      const user = await loginWithPassword({ email: cleanEmail, password });
      router.replace(user?.profileComplete ? "/movies" : "/complete-profile");
    } catch (error) {
      Alert.alert("Sign in failed", error?.message || "Please try again.");
    }
  }

  return (
    <AppKeyboardView className="bg-gray-50 px-6 pt-14">
      <Text className="text-3xl font-bold text-gray-900">Sign in with Email</Text>
      <Text className="text-gray-600 mt-3 leading-6">Use your email and password to continue.</Text>

      <View className="mt-6">
        <AppInput placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <AppInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <AppButton className="bg-cyan-500 border-cyan-500" onPress={onSignin} disabled={authLoading}>
          {authLoading ? "Signing in..." : "Sign in"}
        </AppButton>
        <AppButton variant="secondary" onPress={() => router.replace("/login")} disabled={authLoading}>
          Back
        </AppButton>
      </View>

      {authLoading ? (
        <View className="mt-4 items-center">
          <ActivityIndicator size="small" color="#06b6d4" />
        </View>
      ) : null}
    </AppKeyboardView>
  );
}

