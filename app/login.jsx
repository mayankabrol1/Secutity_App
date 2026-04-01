import { FontAwesome } from "@expo/vector-icons";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { Redirect, useRouter } from "expo-router";
import { ActivityIndicator, Alert, Image, Text, View } from "react-native";
import { useEffect, useMemo, useRef } from "react";

import AppButton from "../components/UI/AppButton";
import { useAppState } from "../lib/app-state";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { currentUser, isReady, loginWithGoogle, signupWithGoogle, authLoading, authError } = useAppState();
  const lastHandledTokenRef = useRef("");
  const googleIntentRef = useRef("signin");
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
        const authAction = googleIntentRef.current === "signup" ? signupWithGoogle : loginWithGoogle;
        const user = await authAction(idToken);
        router.replace(user?.profileComplete ? "/movies" : "/complete-profile");
      } catch (error) {
        if (googleIntentRef.current === "signup") {
          Alert.alert("Sign up failed", error?.message || "Please try again.");
        }
      }
    }
    handleResponse();
  }, [loginWithGoogle, response, router, signupWithGoogle]);

  function onGooglePress(intent) {
    googleIntentRef.current = intent;
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
      Sign in to discover, view, and save movies and TV shows to your library.
      </Text>

      <View className="mt-5">
        <Text className="text-gray-700 mb-2">Already have an account?</Text>
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
          className="bg-white border-gray-300 py-4 mb-3"
          onPress={() => onGooglePress("signin")}
          disabled={!request || authLoading}
        >
          <View className="flex-row items-center gap-2 ">
            <FontAwesome name="google" size={16} color="#111827" />
            <Text className="font-semibold text-gray-900">
              {authLoading ? "Signing in..." : "Sign in with Google"}
            </Text>
          </View>
        </AppButton>

        <Text className="text-gray-700 mt-2 mb-2">New here?</Text>
        <AppButton
          className="bg-cyan-500 border-cyan-500 py-4"
          onPress={() => router.push("/email-signup")}
          disabled={authLoading}
        >
          <View className="flex-row items-center gap-2">
            <FontAwesome name="user" size={16} color="#ffffff" />
            <Text className="font-semibold text-white">Sign up with Email</Text>
          </View>
        </AppButton>
        <AppButton
          className="bg-cyan-500 border-cyan-500 py-4"
          onPress={() => onGooglePress("signup")}
          disabled={!request || authLoading}
        >
          <View className="flex-row items-center gap-2">
            <FontAwesome name="google" size={16} color="#ffffff" />
            <Text className="font-semibold text-white">{authLoading ? "Signing up..." : "Sign up with Google"}</Text>
          </View>
        </AppButton>
       {/* {!!authError && <Text className="text-red-600 mt-2">{authError}</Text>}
        {!webClientId ? (
          <Text className="text-amber-600 mt-2">
            Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in environment configuration.
          </Text>
        ) : null}
       {/*{!!debugRedirectUri ? (
          <Text className="text-gray-500 text-xs mt-2">Redirect URI: {debugRedirectUri}</Text>
        ) : null}*/}
      </View>
    </View>
  );
}
