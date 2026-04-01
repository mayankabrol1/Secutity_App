import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Redirect, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Image, Text, View } from "react-native";

import AppButton from "../components/UI/AppButton";
import AppInput from "../components/UI/AppInput";
import AppKeyboardView from "../components/UI/AppKeyboardView";
import AppSelect from "../components/UI/AppSelect";
import { COUNTRY_CODE_OPTIONS, COUNTRY_OPTIONS } from "./complete-profile";
import { useAppState } from "../lib/app-state";
import { validateProfilePayload } from "../lib/profile-validation";

export default function EmailSignupScreen() {
  const router = useRouter();
  const { currentUser, signupWithPassword, authLoading } = useAppState();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatarDataUri, setAvatarDataUri] = useState("");
  const [avatarPreviewUri, setAvatarPreviewUri] = useState("");
  const [phoneCode, setPhoneCode] = useState("+1");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [country, setCountry] = useState("");
  const allowedCodes = useMemo(() => new Set(COUNTRY_CODE_OPTIONS.map((option) => option.value)), []);
  const allowedCountries = useMemo(() => new Set(COUNTRY_OPTIONS.map((option) => option.value)), []);

  if (currentUser) return <Redirect href="/movies" />;

  async function onPickProfileImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow photo library access to choose a profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      selectionLimit: 1,
      quality: 0.3,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    const longestSide = Math.max(asset.width || 0, asset.height || 0);
    const targetWidth = longestSide > 512 ? 512 : asset.width || 512;
    const manipulated = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: targetWidth } }],
      {
        compress: 0.5,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );
    if (!manipulated.base64) {
      Alert.alert("Image error", "Could not read the selected image. Please try another one.");
      return;
    }
    setAvatarPreviewUri(manipulated.uri);
    setAvatarDataUri(`data:image/jpeg;base64,${manipulated.base64}`);
  }

  async function onSignup() {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanName || !cleanEmail || !password) {
      Alert.alert("Missing Info", "Name, email and password are required.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Weak Password", "Password must be at least 8 characters.");
      return;
    }
    const validationError = validateProfilePayload({
      phoneCode: phoneCode.trim(),
      phoneNumber: phoneNumber.trim(),
      country: country.trim(),
      allowedCodes,
      allowedCountries,
    });
    if (validationError) {
      Alert.alert("Invalid details", validationError);
      return;
    }

    const phone = `${phoneCode.trim()} ${phoneNumber.trim()}`.trim();
    try {
      await signupWithPassword({
        name: cleanName,
        email: cleanEmail,
        password,
        avatarUrl: avatarDataUri,
        phone,
        country: country.trim(),
      });
      router.replace("/movies");
    } catch (error) {
      Alert.alert("Sign up failed", error?.message || "Please try again.");
    }
  }

  return (
    <AppKeyboardView
      className="bg-gray-50 px-6 pt-14 pb-6"
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      <Text className="text-3xl font-bold text-gray-900">Sign up with Email</Text>
      <Text className="text-gray-600 mt-3 leading-6">Create your account details below.</Text>

      <View className="mt-6">
        <AppInput placeholder="Full name" value={name} onChangeText={setName} />
        <AppInput placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <AppInput placeholder="Password (min 8 chars)" value={password} onChangeText={setPassword} secureTextEntry />
        <Text className="text-gray-700 font-medium mb-2">Profile Picture</Text>
        <View className="mb-3">
          <AppButton
            variant="secondary"
            className="w-auto self-start px-4 py-2 mb-0"
            onPress={onPickProfileImage}
          >
            {avatarPreviewUri ? "Change Profile Picture" : "Choose from Camera Roll"}
          </AppButton>
          {avatarPreviewUri ? (
            <View className="items-center mt-6">
              <Image source={{ uri: avatarPreviewUri }} className="h-56 w-56 rounded-2xl" />
            </View>
          ) : null}
        </View>

        <Text className="text-gray-700 font-medium mb-2">Phone</Text>
        <View className="flex-row items-center gap-2 mb-3">
          <AppSelect
            className="w-40"
            modalTitle="Select Country Code"
            value={phoneCode}
            options={COUNTRY_CODE_OPTIONS}
            placeholder="Code"
            onChange={setPhoneCode}
            sheetHeightRatio={0.65}
          />
          <AppInput
            className="flex-1 mb-0"
            placeholder="Enter phone number"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />
        </View>

        <Text className="text-gray-700 font-medium mb-2">Country</Text>
        <AppSelect
          className="mb-3"
          modalTitle="Select Country"
          value={country}
          options={COUNTRY_OPTIONS}
          placeholder="Select your country"
          onChange={setCountry}
          sheetHeightRatio={0.65}
        />

        <AppButton className="bg-cyan-500 border-cyan-500" onPress={onSignup} disabled={authLoading}>
          {authLoading ? "Creating account..." : "Sign up"}
        </AppButton>
        <AppButton variant="secondary" onPress={() => router.replace("/login")} disabled={authLoading}>
          Back
        </AppButton>
      </View>
    </AppKeyboardView>
  );
}

