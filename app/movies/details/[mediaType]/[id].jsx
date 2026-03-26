import { FontAwesome } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";

import { useAppState } from "../../../../lib/app-state";
import { fetchMovieById, fetchMovieReleaseDates, fetchTvById, getPosterUrl } from "../../../../lib/tmdb";

function getTitle(item) {
  return item?.title || item?.name || item?.original_title || item?.original_name || "Details";
}

function getDate(item) {
  return item?.release_date || item?.first_air_date || "";
}

function getRegionalTheatricalDate(releaseDates, preferredRegions = ["CA", "US", "GB"]) {
  const results = Array.isArray(releaseDates?.results) ? releaseDates.results : [];
  for (const region of preferredRegions) {
    const regionEntry = results.find((r) => r.iso_3166_1 === region);
    if (!regionEntry || !Array.isArray(regionEntry.release_dates)) continue;
    const theatrical = regionEntry.release_dates.find((r) => r.type === 3) ||
      regionEntry.release_dates.find((r) => r.type === 2) ||
      regionEntry.release_dates.find((r) => r.type === 4);
    if (theatrical?.release_date) return theatrical.release_date.slice(0, 10);
  }
  return "";
}

export default function DetailsScreen() {
  const router = useRouter();
  const { mediaType, id, returnTo } = useLocalSearchParams();
  const { currentUser, isSaved, toggleSaved } = useAppState();

  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [data, setData] = useState(null);
  const [regionalDate, setRegionalDate] = useState("");

  const title = useMemo(() => getTitle(data), [data]);
  const mt = String(mediaType || "movie");
  const fallbackRoute = String(returnTo || "/movies");

  function handleBackPress() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(fallbackRoute);
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setApiError("");
      setData(null);
      setRegionalDate("");
      try {
        const numericId = String(id);
        const mt = String(mediaType);
        const res =
          mt === "tv" ? await fetchTvById(numericId) : await fetchMovieById(numericId);
        if (mt !== "tv") {
          const releaseDates = await fetchMovieReleaseDates(numericId);
          const date = getRegionalTheatricalDate(releaseDates);
          if (mounted) setRegionalDate(date);
        }
        if (mounted) setData(res);
      } catch (e) {
        if (mounted) setApiError("Failed to load details. Check your TMDB API key.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [id, mediaType]);

  const poster = getPosterUrl(data?.poster_path);
  const isCurrentlySaved = isSaved(mt, id);

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ paddingBottom: 28 }}>
      <Stack.Screen
        options={{
          title,
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable className="h-12 w-12 items-center justify-center -ml-1 -mt-1" onPress={handleBackPress}>
              <FontAwesome name="chevron-left" size={19} color="#111827" />
            </Pressable>
          ),
        }}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center pt-16">
          <ActivityIndicator size="large" color="#06b6d4" />
        </View>
      ) : apiError ? (
        <View className="px-6 pt-10">
          <Text className="text-red-600">{apiError}</Text>
        </View>
      ) : (
        <View className="px-6 pt-8">
          <Text className="text-3xl font-semibold text-gray-800 text-center">{title}</Text>

          <View className="items-center mt-6">
            {poster ? (
              <Image source={{ uri: poster }} style={{ width: 240, height: 340, borderRadius: 6 }} />
            ) : (
              <View style={{ width: 240, height: 340 }} className="bg-gray-200 items-center justify-center rounded">
                <Text className="text-gray-500">No Image</Text>
              </View>
            )}
          </View>

          <Text className="text-gray-600 leading-6 mt-6">
            {data?.overview || "No overview available."}
          </Text>

          {currentUser ? (
            <View className="mt-6">
              <Pressable
                className={`px-4 py-1 rounded border ${
                  isCurrentlySaved ? "bg-amber-300 border-amber-300" : "bg-white border-gray-300"
                }`}
                onPress={() => {
                  if (isCurrentlySaved) return;
                  toggleSaved({
                    id: String(id),
                    mediaType: mt,
                    title,
                    date: getDate(data),
                    popularity: data?.popularity,
                    posterPath: data?.poster_path,
                  });
                }}
              >
                <Text className="text-center font-semibold text-gray-800">
                  {isCurrentlySaved ? "Saved to Library" : "Save to Library"}
                </Text>
              </Pressable>

              {isCurrentlySaved ? (
                <Pressable
                  className="px-4 py-1 rounded border border-gray-300 bg-white mt-2"
                  onPress={() =>
                    toggleSaved({
                      id: String(id),
                      mediaType: mt,
                      title,
                      date: getDate(data),
                      popularity: data?.popularity,
                      posterPath: data?.poster_path,
                    })
                  }
                >
                  <Text className="text-center font-semibold text-gray-800">Remove</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <Text className="text-gray-600 mt-8">
            Popularity: {typeof data?.popularity === "number" ? data.popularity.toFixed(3) : "—"} |{" "}
            Release Date: {regionalDate || getDate(data)}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}


