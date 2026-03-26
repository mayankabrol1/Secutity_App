import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image, Modal, Pressable, Text, View } from "react-native";
import { useState } from "react";

import { useAppState } from "../../lib/app-state";

export default function ProfileMenuButton() {
  const router = useRouter();
  const { currentUser, logout } = useAppState();
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable
        onPress={() => setOpen(true)}
        className={`h-11 w-11 rounded-full items-center justify-center overflow-hidden ${
          currentUser?.photoUrl ? "" : "bg-white border border-gray-200"
        }`}
      >
        {currentUser?.photoUrl ? (
          <Image source={{ uri: currentUser.photoUrl }} className="h-full w-full rounded-full" />
        ) : (
          <FontAwesome name="user" size={20} color="#374151" />
        )}
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/20" onPress={() => setOpen(false)}>
          <View className="absolute top-[84px] right-5 w-56 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <Pressable
              onPress={() => {
                setOpen(false);
                router.push("/profile");
              }}
              className="px-5 py-4"
            >
              <Text className="text-gray-800 font-medium text-base">View Profile</Text>
            </Pressable>
            <View className="h-px bg-gray-200" />
            <Pressable
              onPress={() => {
                setOpen(false);
                logout();
                router.replace("/login");
              }}
              className="px-5 py-4"
            >
              <Text className="text-red-600 font-medium text-base">Logout</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
