import { FontAwesome } from "@expo/vector-icons";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { Redirect, useRouter } from "expo-router";
import { ActivityIndicator, Alert, Image, Text, View } from "react-native";
import { useEffect, useMemo, useRef } from "react";

import AppButton from "../components/UI/AppButton";
import { useAppState } from "../lib/app-state";
import { prefetchDefaultMovies } from "../lib/tmdb";

WebBrowser.maybeCompleteAuthSession();

function stripApiSuffix(message) {
  return String(message || "").replace(/\s*\(API:\s*[^)]+\)\s*$/, "").trim();
}

function getAuthAlertTitle(message) {
  const normalized = message.toLowerCase();
  if (normalized.includes("account already exists")) return "Account already exists";
  if (normalized.includes("incorrect email or password")) return "Sign in failed";
  if (normalized.includes("sign in with google")) return "Use Google sign-in";
  if (normalized.includes("no account found")) return "Account not found";
  return "Authentication error";
}

function getAuthAlertMessage(message) {
  const normalized = message.toLowerCase();
  if (normalized.includes("account already exists")) {
    return "Please sign in instead.";
  }
  return message;
}

export default function LoginScreen() {
  const router = useRouter();
  const { currentUser, isReady, loginWithGoogle, authLoading, authError, clearAuthError } = useAppState();
  const lastHandledTokenRef = useRef("");
  const lastAuthErrorRef = useRef("");
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || webClientId;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || webClientId;
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId,
    iosClientId,
    androidClientId,
    scopes: ["profile", "email"],
  });
  const debugRedirectUri = useMemo(() => {
    if (!request?.url) return "";
    const match = request.url.match(/[?&]redirect_uri=([^&]+)/);
    if (!match?.[1]) return "";
    try {
      return decodeURIComponent(match[1]);
    } catch (error) {
      return match[1];
    }
  }, [request?.url]);

  useEffect(() => {
    async function handleResponse() {
      if (response?.type !== "success") return;
      const idToken = response.params?.id_token;
      if (!idToken) return;
      if (lastHandledTokenRef.current === idToken) return;
      lastHandledTokenRef.current = idToken;
      try {
        const user = await loginWithGoogle(idToken);
        if (user?.profileComplete) {
          prefetchDefaultMovies();
        }
        router.replace(user?.profileComplete ? "/movies" : "/complete-profile");
      } catch (error) {
        // Errors are surfaced through authError alert effect below.
      }
    }
    handleResponse();
  }, [loginWithGoogle, response, router]);

  useEffect(() => {
    const rawMessage = String(authError || "").trim();
    const message = stripApiSuffix(rawMessage);
    if (!message || message === lastAuthErrorRef.current) return;
    lastAuthErrorRef.current = message;
    Alert.alert(getAuthAlertTitle(message), getAuthAlertMessage(message));
    clearAuthError();
  }, [authError, clearAuthError]);

  function onGooglePress() {
    promptAsync();
  }

  if (!isReady) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  if (currentUser) return <Redirect href="/movies" />;

  return (
    <View className="flex-1 bg-gray-60 px-6 pt-14">
      <View className="items-center">
        <Image source={require("../assets/login-logo.png")} className="h-40 w-40 mb-4 rounded-full" resizeMode="cover" />
      </View>
      <Text className="text-3xl font-bold text-gray-900 text-center">Welcome to Movies App</Text>
      <Text className="text-lg text-gray-600 mt-3 mb-3 leading-6 text-center ">
        Sign in or create an account to save movies and TV shows to your library.
      </Text>

      <View className="mt-6">
        <AppButton
          className="bg-white border-gray-300 py-4"
          onPress={() => router.push("/email-signin")}
          disabled={authLoading}
        >
          <View className="flex-row items-center gap-2">
            <FontAwesome name="envelope-o" size={16} color="#111827" />
            <Text className="font-semibold text-gray-900">Sign in with Email</Text>
          </View>
        </AppButton>
        <AppButton
          className="bg-cyan-500 border-cyan-500 py-4"
          onPress={() => router.push("/email-signup")}
          disabled={authLoading}
        >
          <View className="flex-row items-center gap-2">
            <FontAwesome name="envelope-o" size={16} color="#ffffff" />
            <Text className="font-semibold text-white">Sign up with Email</Text>
          </View>
        </AppButton>

        <View className="flex-row items-center my-5">
          <View className="flex-1 h-0.5 bg-gray-200" />
          <View className="flex-1 h-0.5 bg-gray-200" />
        </View>

        <AppButton
          className="bg-white border-gray-300 py-4"
          onPress={onGooglePress}
          disabled={!request || authLoading}
        >
          <View className="flex-row items-center gap-2">
            <FontAwesome name="google" size={16} color="#111827" />
            <Text className="font-semibold text-gray-900">
              {authLoading ? "Continuing..." : "Continue with Google"}
            </Text>
          </View>
        </AppButton>
      </View>
    </View>
  );
}
