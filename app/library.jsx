import { Redirect, useRouter } from "expo-router";
import { FlatList, Image, Pressable, Text, View } from "react-native";

import AppTopBar from "../components/UI/AppTopBar";
import { useAppState } from "../lib/app-state";
import { getPosterUrl } from "../lib/tmdb";

export default function LibraryScreen() {
  const router = useRouter();
  const { currentUser, savedItems, toggleSaved } = useAppState();

  if (!currentUser) return <Redirect href="/login" />;
  if (!currentUser.profileComplete) return <Redirect href="/complete-profile" />;

  return (
    <View className="flex-1 bg-gray-50">
      <AppTopBar
        title="Saved Library"
        showLibraryButton={false}
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace("/movies");
        }}
      />
      <View className="px-5 py-4">
        <Text className="text-gray-700">
          
        </Text>
      </View>

      <FlatList
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        data={savedItems}
        keyExtractor={(item) => `${item.mediaType}-${item.id}`}
        ListEmptyComponent={
          <View className="py-24 items-center">
            <Text className="text-2xl text-gray-500">No saved titles yet.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const poster = getPosterUrl(item.posterPath);
          return (
            <View className="flex-row bg-white border border-gray-200 rounded-lg overflow-hidden mb-3">
              {poster ? (
                <Image source={{ uri: poster }} style={{ width: 92, height: 132 }} />
              ) : (
                <View style={{ width: 92, height: 132 }} className="bg-gray-200 items-center justify-center">
                  <Text className="text-gray-500 text-xs">No Image</Text>
                </View>
              )}
              <View className="flex-1 p-3">
                <Text className="text-base font-semibold text-gray-900 mb-1" numberOfLines={2}>
                  {item.title}
                </Text>
                <Text className="text-gray-600">Type: {item.mediaType === "tv" ? "TV Show" : "Movie"}</Text>
                <Text className="text-gray-600">Release Date: {item.date || "—"}</Text>
                <View className="flex-row gap-2 mt-3">
                  <Pressable
                    className="px-4 py-3 rounded border border-cyan-500 bg-cyan-500"
                    onPress={() =>
                      router.push({
                        pathname: "/movies/details/[mediaType]/[id]",
                        params: { mediaType: item.mediaType, id: String(item.id), returnTo: "/library" },
                      })
                    }
                  >
                    <Text className="text-white font-bold">Open</Text>
                  </Pressable>
                  <Pressable
                    className="px-4 py-3 rounded border border-gray-300 bg-white"
                    onPress={() => toggleSaved(item)}
                  >
                    <Text className="text-gray-800 font-semibold">Remove</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}
