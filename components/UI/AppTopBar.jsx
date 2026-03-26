import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import ProfileMenuButton from "./ProfileMenuButton";

export default function AppTopBar({ title, onBack, showLibraryButton = true }) {
  const router = useRouter();

  return (
    <View className="bg-slate-700 px-5 py-4 flex-row items-center justify-between">
      <View className="flex-row items-center gap-4">
        {onBack ? (
          <Pressable
            onPress={onBack}
            className="h-9 w-9 rounded-full bg-white items-center justify-center border border-gray-200"
          >
            <FontAwesome name="chevron-left" size={14} color="#1f2937" />
          </Pressable>
        ) : null}
        <Text className="text-white text-xl font-semibold">{title}</Text>
      </View>
      <View className="flex-row items-center gap-4">
        {showLibraryButton ? (
          <Pressable
            onPress={() => router.push("/library")}
            className="h-9 w-9 rounded-full bg-white items-center justify-center border border-gray-200"
          >
            <FontAwesome name="bookmark" size={18} color="#1f2937" />
          </Pressable>
        ) : null}
        <ProfileMenuButton />
      </View>
    </View>
  );
}
