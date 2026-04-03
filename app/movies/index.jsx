import { FontAwesome } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, Keyboard, Pressable, Text, View } from "react-native";

import AppTopBar from "../../components/UI/AppTopBar";
import AppSelect from "../../components/UI/AppSelect";
import AppButton from "../../components/UI/AppButton";
import AppInput from "../../components/UI/AppInput";
import { useAppState } from "../../lib/app-state";
import { fetchMovies, fetchSearch, fetchTv, getPosterUrl, getTmdbRegion } from "../../lib/tmdb";

const TAB_KEYS = {
  movies: "movies",
  search: "search",
  tv: "tv",
};

const MOVIE_OPTIONS = [
  { label: "Now Playing", value: "now_playing" },
  { label: "Popular", value: "popular" },
  { label: "Top Rated", value: "top_rated" },
  { label: "Upcoming", value: "upcoming" },
];

const TV_OPTIONS = [
  { label: "Airing Today", value: "airing_today" },
  { label: "Popular", value: "popular" },
  { label: "Top Rated", value: "top_rated" },
];

const SEARCH_OPTIONS = [
  { label: "Multi", value: "multi" },
  { label: "Movie", value: "movie" },
  { label: "TV", value: "tv" },
];

function getTitle(item) {
  return item?.title || item?.name || item?.original_title || item?.original_name || "Untitled";
}

function getDate(item) {
  return item?.release_date || item?.first_air_date || "";
}

function isTodayOrFuture(dateValue) {
  if (!dateValue || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateValue))) return false;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
  return String(dateValue) >= todayStr;
}

function getMediaTypeFromItem(activeTab, searchType, item) {
  if (activeTab === TAB_KEYS.movies) return "movie";
  if (activeTab === TAB_KEYS.tv) return "tv";
  if (searchType !== "multi") return searchType;
  return item?.media_type || "movie";
}

function TopTabs({ activeTab, onChange }) {
  const tabs = [
    { key: TAB_KEYS.movies, label: "Movies" },
    { key: TAB_KEYS.search, label: "Search Results" },
    { key: TAB_KEYS.tv, label: "TV Shows" },
  ];

  return (
    <View className="flex-row bg-gray-100 border-b border-gray-200">
      {tabs.map((t) => {
        const isActive = t.key === activeTab;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            className="flex-1 py-3 items-center"
            style={{
              borderBottomWidth: isActive ? 2 : 0,
              borderBottomColor: isActive ? "#1f2937" : "transparent",
            }}
          >
            <Text style={{ color: isActive ? "#1f2937" : "#9ca3af", fontWeight: isActive ? "600" : "500" }}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ResultRow({ item, onPressDetails, onToggleSave, saved }) {
  const poster = getPosterUrl(item?.poster_path);
  const title = getTitle(item);
  const popularity = typeof item?.popularity === "number" ? item.popularity.toFixed(3) : "—";
  const date = getDate(item);

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
          {title}
        </Text>
        <Text className="text-gray-600">Popularity: {popularity}</Text>
        <Text className="text-gray-600">Release Date: {date}</Text>

        <View className="mt-2">
          <View className="flex-row gap-2">
            <AppButton className="bg-cyan-500 border-cyan-500 py-3 flex-1" onPress={onPressDetails}>
              <Text style={{ color: "#ffffff", fontWeight: "700" }}>More Details</Text>
            </AppButton>
            <AppButton
              className={`py-3 flex-1 ${saved ? "bg-amber-400 border-amber-400" : "bg-white border-gray-300"}`}
              onPress={onToggleSave}
            >
              <Text style={{ color: saved ? "#111827" : "#374151", fontWeight: "700" }}>
                {saved ? "Saved" : "Save"}
              </Text>
            </AppButton>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function MoviesAppScreen() {
  const router = useRouter();
  const { currentUser, isReady, isSaved, toggleSaved } = useAppState();

  const [activeTab, setActiveTab] = useState(TAB_KEYS.movies);
  const [movieType, setMovieType] = useState("now_playing");
  const [tvType, setTvType] = useState("popular");

  const [searchType, setSearchType] = useState("multi");
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchCompleted, setSearchCompleted] = useState(false);
  const [searchPageLoading, setSearchPageLoading] = useState(false);
  const searchRequestIdRef = useRef(0);
  const browseRequestIdRef = useRef(0);

  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [results, setResults] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [pageChanging] = useState(false);

  const perPage = 10;
  const [pageIndex, setPageIndex] = useState(1);
  const [region, setRegion] = useState(() => getTmdbRegion());

  const filteredResults = useMemo(() => {
    if (activeTab === TAB_KEYS.movies && movieType === "upcoming") {
      return results.filter((item) => isTodayOrFuture(getDate(item)));
    }
    return results;
  }, [activeTab, movieType, results, searchType]);

  const totalPages = Math.max(1, Math.ceil(totalResults / perPage));
  const pageResults = filteredResults;

  function resetPaging() {
    setPageIndex(1);
  }

  function goToPage(nextPage) {
    if (activeTab === TAB_KEYS.search && searchPageLoading) {
      return;
    }
    if (activeTab === TAB_KEYS.search) {
      setSearchCompleted(false);
      setSearchPageLoading(true);
    }
    setPageIndex(nextPage);
  }

  async function loadMovies(localPage = pageIndex) {
    const browseRequestId = ++browseRequestIdRef.current;
    setLoading(true);
    setApiError("");
    try {
      const tmdbPage = Math.max(1, Math.ceil(localPage / 2));
      const data = await fetchMovies(movieType, tmdbPage, { region });
      if (browseRequestId !== browseRequestIdRef.current) return;
      const all = Array.isArray(data?.results) ? data.results : [];
      const sliceStart = localPage % 2 === 1 ? 0 : perPage;
      setResults(all.slice(sliceStart, sliceStart + perPage));
      setTotalResults(Number(data?.total_results || 0));
    } catch (e) {
      if (browseRequestId !== browseRequestIdRef.current) return;
      setApiError("Failed to load movies. Check your TMDB API key.");
      setResults([]);
      setTotalResults(0);
    } finally {
      if (browseRequestId !== browseRequestIdRef.current) return;
      setLoading(false);
    }
  }

  async function loadTv(localPage = pageIndex) {
    const browseRequestId = ++browseRequestIdRef.current;
    setLoading(true);
    setApiError("");
    try {
      const tmdbPage = Math.max(1, Math.ceil(localPage / 2));
      const data = await fetchTv(tvType, tmdbPage, { region });
      if (browseRequestId !== browseRequestIdRef.current) return;
      const all = Array.isArray(data?.results) ? data.results : [];
      const sliceStart = localPage % 2 === 1 ? 0 : perPage;
      setResults(all.slice(sliceStart, sliceStart + perPage));
      setTotalResults(Number(data?.total_results || 0));
    } catch (e) {
      if (browseRequestId !== browseRequestIdRef.current) return;
      setApiError("Failed to load TV shows. Check your TMDB API key.");
      setResults([]);
      setTotalResults(0);
    } finally {
      if (browseRequestId !== browseRequestIdRef.current) return;
      setLoading(false);
    }
  }

  async function loadSearch(localPage = pageIndex) {
    const q = query.trim();
    if (!q) return;
    const searchRequestId = ++searchRequestIdRef.current;
    setLoading(true);
    setApiError("");
    setSearchCompleted(false);
    setSearchPageLoading(true);
    try {
      const tmdbPage = Math.max(1, Math.ceil(localPage / 2));
      const data = await fetchSearch(searchType, q, tmdbPage, { region });
      if (searchRequestId !== searchRequestIdRef.current) return;
      const all = Array.isArray(data?.results) ? data.results : [];
      const sliceStart = localPage % 2 === 1 ? 0 : perPage;
      setResults(all.slice(sliceStart, sliceStart + perPage));
      setTotalResults(Number(data?.total_results || 0));
    } catch (e) {
      if (searchRequestId !== searchRequestIdRef.current) return;
      setApiError("Failed to search. Check your TMDB API key.");
      setResults([]);
      setTotalResults(0);
    } finally {
      if (searchRequestId !== searchRequestIdRef.current) return;
      setLoading(false);
      setSearchCompleted(true);
      setSearchPageLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === TAB_KEYS.movies) loadMovies();
    if (activeTab === TAB_KEYS.tv) loadTv();
    if (activeTab === TAB_KEYS.search) {
      if (hasSearched && query.trim()) loadSearch();
      else {
        setResults([]);
        setTotalResults(0);
        setSearchCompleted(false);
      }
    }
  }, [activeTab, movieType, tvType, pageIndex, region]);

  useEffect(() => {
    let mounted = true;
    async function resolveRegionFromGps() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") return;

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const places = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        const countryCode = String(
          places?.[0]?.isoCountryCode || places?.[0]?.countryCode || ""
        )
          .trim()
          .toUpperCase();

        if (!mounted || !/^[A-Z]{2}$/.test(countryCode) || countryCode === region) return;
        setRegion(countryCode);
      } catch (error) {
        // Keep locale/env fallback region if GPS lookup fails.
      }
    }

    resolveRegionFromGps();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (activeTab === TAB_KEYS.search && hasSearched && query.trim()) loadSearch();
  }, [searchType, pageIndex, region]);

  const showSearchPrompt = activeTab === TAB_KEYS.search && !hasSearched;
  const isSearchLoading =
    activeTab === TAB_KEYS.search && hasSearched && (loading || searchPageLoading || !searchCompleted);

  if (!isReady) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  if (!currentUser) {
    return <Redirect href="/login" />;
  }
  if (!currentUser.profileComplete) {
    return <Redirect href="/complete-profile" />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      <AppTopBar title="Movies App" />

      <TopTabs
        activeTab={activeTab}
        onChange={(k) => {
          setApiError("");
          setSearchError("");
          resetPaging();
          setActiveTab(k);
        }}
      />

      <View className="px-5 py-4">
        {activeTab === TAB_KEYS.movies && (
          <AppSelect
            label="Choose Movie Type "
            labelClassName="text-base font-semibold"
            value={movieType}
            options={MOVIE_OPTIONS}
              onChange={(v) => {
                resetPaging();
                setMovieType(v);
              }}
          />
        )}

        {activeTab === TAB_KEYS.tv && (
          <AppSelect
            label="Choose TV Show Type "
            labelClassName="text-base font-semibold"
            value={tvType}
            options={TV_OPTIONS}
              onChange={(v) => {
                resetPaging();
                setTvType(v);
              }}
          />
        )}

        {activeTab === TAB_KEYS.search && (
          <View>
            <View className="flex-row items-center mb-1">
              <Text className="text-base font-semibold text-gray-800">Search Movie/TV Show Name</Text>
              <Text className="text-red-500 ml-[2px] ">*</Text>
            </View>

            <View
              className="flex-row items-center px-4 py-3 rounded-lg"
              style={{
                backgroundColor: "#f3f4f6",
                borderWidth: 1,
                borderColor: searchError ? "#ef4444" : "#e5e7eb",
              }}
            >
              <View className="flex-1">
                <AppInput
                  value={query}
                  onChangeText={(t) => {
                    setQuery(t);
                    if (searchError) setSearchError("");
                  }}
                  placeholder="Enter name here..."
                  className="mb-0 border-0 bg-transparent px-0 py-0"
                />
              </View>
            </View>

            <View className="flex-row items-start gap-3 mt-3 mb-3">
              <View className="flex-1">
                <AppSelect
                  label="Choose Search Type "
                  labelClassName="text-base font-semibold"
                  value={searchType}
                  options={SEARCH_OPTIONS}
                  onChange={(v) => {
                    resetPaging();
                    setSearchType(v);
                  }}
                  hasError={!!searchError}
                  sheetHeightRatio={0.22}
                  showRequired
                />
              </View>
              <View style={{ width: 140 }}>
                <Text className="text-base font-semibold text-transparent mb-1">Spacer</Text>
                <AppButton
                  className="bg-cyan-500 border-cyan-500 px-4 py-3"
                  onPress={async () => {
                    Keyboard.dismiss();
                    const q = query.trim();
                    if (!q) {
                      setSearchError("required");
                      setHasSearched(false);
                      setResults([]);
                      setTotalResults(0);
                      return;
                    }
                    setSearchError("");
                    setSearchCompleted(false);
                    setHasSearched(true);
                    setSearchPageLoading(true);
                    goToPage(1);
                    await loadSearch(1);
                  }}
                >
                  <View className="flex-row items-center justify-center gap-2 h-[17px] px-4 py-0">
                    <FontAwesome name="search" size={17} color="#ffffff" />
                    <Text style={{ color: "#ffffff", fontWeight: "700" }}>Search</Text>
                  </View>
                </AppButton>
              </View>
            </View>

            {!!searchError && <Text className="text-red-500 -mt-1">Movie/TV Show Name and Search Type are Required</Text>}
          </View>
        )}
      </View>

      {apiError ? (
        <View className="px-5">
          <Text className="text-red-600">{apiError}</Text>
        </View>
      ) : null}

      {showSearchPrompt ? (
        <View className="flex-1 px-4 pt-24">
          <Text className="text-3xl font-semibold text-gray-800 text-center ">Please initiate a search</Text>
        </View>
      ) : isSearchLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#06b6d4" />
        </View>
      ) : loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#06b6d4" />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          data={pageResults}
          keyExtractor={(item, index) =>
            activeTab === TAB_KEYS.search && searchType === "multi"
              ? `${item.media_type}-${item.id}-${index}`
              : String(item.id)
          }
          renderItem={({ item }) => {
            const mediaType = getMediaTypeFromItem(activeTab, searchType, item);
            return (
              <ResultRow
                item={item}
                saved={isSaved(mediaType, item.id)}
                onToggleSave={() =>
                  toggleSaved({
                    id: item.id,
                    mediaType,
                    title: getTitle(item),
                    date: getDate(item),
                    popularity: item?.popularity,
                    posterPath: item?.poster_path,
                  })
                }
                onPressDetails={() => {
                  router.push({
                    pathname: "/movies/details/[mediaType]/[id]",
                    params: { mediaType, id: String(item.id), returnTo: "/movies" },
                  });
                }}
              />
            );
          }}
          ListEmptyComponent={() =>
            isSearchLoading ? (
              <View className="px-5 py-[130px] items-center">
                <ActivityIndicator size="large" color="#06b6d4" />
              </View>
            ) : activeTab === TAB_KEYS.search && !hasSearched ? null : (
              <View className="px-5 py-[130px] items-center">
                <Text className="text-gray-500 text-2xl">No results found.</Text>
              </View>
            )
          }
        />
      )}

      {totalPages > 1 && totalResults > 0 && !showSearchPrompt ? (
        <View className="pb-4 pt-4 px-6 bg-gray-200">
          <View className="flex-row items-center justify-between">
            {pageIndex > 1 ? (
              <Pressable
                onPress={() => goToPage(pageIndex - 1)}
                className="px-4 py-3 rounded border border-gray-300 bg-white"
                style={{
                  opacity: pageChanging || loading || (activeTab === TAB_KEYS.search && searchPageLoading) ? 0.4 : 1,
                }}
                disabled={pageChanging || loading || (activeTab === TAB_KEYS.search && searchPageLoading)}
              >
                <Text style={{ color: "#111827", fontWeight: "600" }}>Previous</Text>
              </Pressable>
            ) : (
              <View />
            )}
            {pageIndex < totalPages ? (
              <Pressable
                onPress={() => goToPage(pageIndex + 1)}
                className="px-4 py-3 rounded border border-cyan-500 bg-cyan-500"
                style={{
                  opacity: pageChanging || loading || (activeTab === TAB_KEYS.search && searchPageLoading) ? 0.4 : 1,
                }}
                disabled={pageChanging || loading || (activeTab === TAB_KEYS.search && searchPageLoading)}
              >
                <Text style={{ color: "#ffffff", fontWeight: "700" }}>Next</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}


