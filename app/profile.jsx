import { FontAwesome } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useMemo, useState } from "react";
import { Alert, Image, Modal, Pressable, Text, View } from "react-native";

import AppButton from "../components/UI/AppButton";
import AppInput from "../components/UI/AppInput";
import AppSelect from "../components/UI/AppSelect";
import AppTopBar from "../components/UI/AppTopBar";
import { COUNTRY_CODE_OPTIONS, COUNTRY_OPTIONS } from "./complete-profile";
import { validateCountry, validatePhoneFields } from "../lib/profile-validation";
import { useAppState } from "../lib/app-state";

export default function ProfileScreen() {
  const router = useRouter();
  const { currentUser, savedItems, logout, deleteAccount, completeProfile, updateProfileAvatar } = useAppState();
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [phoneCodeDraft, setPhoneCodeDraft] = useState("+1");
  const [phoneNumberDraft, setPhoneNumberDraft] = useState("");
  const [countryDraft, setCountryDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const knownCountryCodes = useMemo(() => new Set(COUNTRY_CODE_OPTIONS.map((option) => option.value)), []);
  const knownCountries = useMemo(() => new Set(COUNTRY_OPTIONS.map((option) => option.value)), []);

  if (!currentUser) return <Redirect href="/login" />;
  if (!currentUser.profileComplete) return <Redirect href="/complete-profile" />;

  function openPhoneModal() {
    const rawPhone = String(currentUser.phone || "").trim();
    const [firstToken, ...rest] = rawPhone.split(" ");
    const parsedCode = firstToken?.startsWith("+") && knownCountryCodes.has(firstToken) ? firstToken : "+1";
    const parsedNumber = firstToken?.startsWith("+") ? rest.join(" ").trim() : rawPhone;
    setPhoneCodeDraft(parsedCode);
    setPhoneNumberDraft(parsedNumber);
    setPhoneModalOpen(true);
  }

  async function savePhone() {
    const cleanCode = phoneCodeDraft.trim();
    const cleanNumber = phoneNumberDraft.trim();
    const phoneError = validatePhoneFields({
      phoneCode: cleanCode,
      phoneNumber: cleanNumber,
      allowedCodes: knownCountryCodes,
    });
    if (phoneError) {
      Alert.alert("Invalid phone", phoneError);
      return;
    }
    const cleanCountry = String(currentUser.country || "").trim();
    const countryError = validateCountry(cleanCountry, knownCountries);
    if (countryError) {
      Alert.alert("Invalid country", "Please update your country first.");
      return;
    }
    const cleanPhone = `${cleanCode} ${cleanNumber}`.trim();
    setSaving(true);
    try {
      await completeProfile({ phone: cleanPhone, country: cleanCountry });
      setPhoneModalOpen(false);
    } catch (error) {
      Alert.alert("Could not update phone", error?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function openCountryModal() {
    setCountryDraft(String(currentUser.country || "").trim());
    setCountryModalOpen(true);
  }

  async function saveCountry() {
    const cleanCountry = countryDraft.trim();
    const cleanPhone = String(currentUser.phone || "").trim();
    const countryError = validateCountry(cleanCountry, knownCountries);
    if (countryError) {
      Alert.alert("Invalid country", countryError);
      return;
    }
    const [firstToken, ...rest] = cleanPhone.split(" ");
    const phoneError = validatePhoneFields({
      phoneCode: firstToken,
      phoneNumber: rest.join(" "),
      allowedCodes: knownCountryCodes,
    });
    if (phoneError) {
      Alert.alert("Invalid phone", "Please update your phone first.");
      return;
    }
    setSaving(true);
    try {
      await completeProfile({ phone: cleanPhone, country: cleanCountry });
      setCountryModalOpen(false);
    } catch (error) {
      Alert.alert("Could not update country", error?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function onPickProfileImage() {
    if (avatarSaving) return;

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

    setAvatarSaving(true);
    try {
      await updateProfileAvatar(`data:image/jpeg;base64,${manipulated.base64}`);
    } catch (error) {
      Alert.alert("Could not update profile picture", error?.message || "Please try again.");
    } finally {
      setAvatarSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-gray-50">
      <AppTopBar
        title="Profile"
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace("/movies");
        }}
      />

      <View className="px-6 pt-8">
        <View className="items-center">
          <View className="relative">
            {currentUser.photoUrl ? (
              <Image source={{ uri: currentUser.photoUrl }} className="h-32 w-32 rounded-full" />
            ) : (
              <View className="h-32 w-32 rounded-full bg-gray-300 items-center justify-center">
                <Text className="text-4xl font-semibold text-gray-700">{currentUser.name?.charAt(0) || "U"}</Text>
              </View>
            )}
            <Pressable
              onPress={onPickProfileImage}
              disabled={avatarSaving}
              className="absolute -top-1 -right-1 h-11 w-11 rounded-full bg-cyan-500 border-4 border-white items-center justify-center"
              style={{ opacity: avatarSaving ? 0.7 : 1 }}
            >
              <FontAwesome name="pencil" size={16} color="#ffffff" />
            </Pressable>
          </View>
          <Text className="text-2xl font-bold text-gray-900 mt-4">{currentUser.name}</Text>
          <Text className="text-gray-600 mt-1">{currentUser.email}</Text>
          {avatarSaving ? <Text className="text-sm text-gray-500 mt-2">Updating profile picture...</Text> : null}
        </View>

        <View className="bg-white border border-gray-200 rounded-xl p-4 mt-8">
          <Text className="text-gray-500 text-sm">Full Name</Text>
          <Text className="text-gray-900 font-semibold mt-1">{currentUser.name || "Unavailable"}</Text>

          <Text className="text-gray-500 text-sm mt-4">Email</Text>
          <Text className="text-gray-900 font-semibold mt-1">{currentUser.email || "Unavailable"}</Text>

          <Text className="text-gray-500 text-sm mt-4">Saved Titles</Text>
          <Text className="text-gray-900 font-semibold mt-1">{savedItems.length}</Text>

          <Text className="text-gray-500 text-sm mt-4">Phone</Text>
          <View className="flex-row items-center justify-between mt-1">
            <Text className="text-gray-900 font-semibold">{currentUser.phone || "Unavailable"}</Text>
            <Pressable onPress={openPhoneModal} className="h-8 w-8 items-center justify-center">
              <FontAwesome name="pencil" size={16} color="#374151" />
            </Pressable>
          </View>

          <Text className="text-gray-500 text-sm mt-4">Country</Text>
          <View className="flex-row items-center justify-between mt-1">
            <Text className="text-gray-900 font-semibold">{currentUser.country || "Unavailable"}</Text>
            <Pressable onPress={openCountryModal} className="h-8 w-8 items-center justify-center">
              <FontAwesome name="pencil" size={16} color="#374151" />
            </Pressable>
          </View>
        </View>

        <View className="mt-8 gap-2">
          <AppButton className="bg-white border-cyan-500 py-3" onPress={() => router.push("/library")}>
            <Text className="text-md font-semibold text-cyan-500">Go to Saved Library</Text>
          </AppButton>
          <AppButton
            className="bg-cyan-500 border-cyan-500 py-3"
            onPress={() => {
              logout();
              router.replace("/login");
            }}
          >
            <Text className="text-md font-semibold text-white">Logout</Text>
          </AppButton>
          <AppButton
            variant="danger"
            className="py-3"
            onPress={() =>
              Alert.alert(
                "Delete Account",
                "This will permanently delete your account and saved titles. This action cannot be undone.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                      await deleteAccount();
                      router.replace("/login");
                    },
                  },
                ]
              )
            }
          >
            <Text className="text-base font-semibold text-white">Delete Account</Text>
          </AppButton>
        </View>
      </View>

      <Modal
        transparent
        visible={phoneModalOpen}
        animationType="fade"
        onRequestClose={() => (saving ? null : setPhoneModalOpen(false))}
      >
        <Pressable className="flex-1 bg-black/30 items-center justify-center px-6" onPress={() => (saving ? null : setPhoneModalOpen(false))}>
          <Pressable className="w-full rounded-xl bg-white p-5 border border-gray-200" onPress={() => {}}>
            <Text className="text-xl font-semibold text-gray-900">Edit Phone</Text>
            <Text className="text-gray-600 mt-1 mb-4">Update your phone number.</Text>
            <Text className="text-gray-700 font-medium mb-2">Phone</Text>
            <View className="flex-row items-center gap-2 mb-4">
              <AppSelect
                className="w-40"
                modalTitle="Select Country Code"
                value={phoneCodeDraft}
                options={COUNTRY_CODE_OPTIONS}
                placeholder="Code"
                onChange={setPhoneCodeDraft}
                sheetHeightRatio={0.65}
              />
              <AppInput
                className="flex-1 mb-0"
                placeholder="Enter phone number"
                value={phoneNumberDraft}
                onChangeText={setPhoneNumberDraft}
              />
            </View>
            <AppButton className="bg-cyan-500 border-cyan-500 mb-1" onPress={savePhone} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </AppButton>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={countryModalOpen}
        animationType="fade"
        onRequestClose={() => (saving ? null : setCountryModalOpen(false))}
      >
        <Pressable
          className="flex-1 bg-black/30 items-center justify-center px-6"
          onPress={() => (saving ? null : setCountryModalOpen(false))}
        >
          <Pressable className="w-full rounded-xl bg-white p-5 border border-gray-200" onPress={() => {}}>
            <Text className="text-xl font-semibold text-gray-900">Edit Country</Text>
            <Text className="text-gray-600 mt-1 mb-4">Update your country.</Text>
            <Text className="text-gray-700 font-medium mb-2">Country</Text>
            <AppSelect
              className="mb-4"
              modalTitle="Select Country"
              value={countryDraft}
              options={COUNTRY_OPTIONS}
              placeholder="Select your country"
              onChange={setCountryDraft}
              sheetHeightRatio={0.65}
            />
            <AppButton className="bg-cyan-500 border-cyan-500 mb-1" onPress={saveCountry} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </AppButton>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
