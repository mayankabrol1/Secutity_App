import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const USER_STORAGE_KEY = "movie_app_user_v1";
const ACCESS_TOKEN_KEY = "movie_app_access_token_v1";
const REFRESH_TOKEN_KEY = "movie_app_refresh_token_v1";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://100.25.116.43:3000";
const EXTRA_REQUEST_HEADERS = API_BASE_URL.includes("loca.lt")
  ? { "bypass-tunnel-reminder": "true" }
  : {};
const AppStateContext = createContext(null);

function normalizeSavedItem(item) {
  return {
    id: String(item.id),
    mediaType: item.mediaType,
    title: item.title || "Untitled",
    date: item.releaseDate || item.date || "",
    popularity: item.popularity ?? null,
    posterPath: item.posterPath || null,
    savedAt: item.savedAt || Date.now(),
  };
}

async function storeTokens(accessToken, refreshToken) {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

export function AppStateProvider({ children }) {
  const [isReady, setIsReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [savedItems, setSavedItems] = useState([]);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  async function refreshAccessToken() {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...EXTRA_REQUEST_HEADERS },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return null;

    const data = await response.json();
    if (!data?.accessToken || !data?.refreshToken || !data?.user) return null;
    await storeTokens(data.accessToken, data.refreshToken);
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
    setCurrentUser(data.user);
    return data.accessToken;
  }

  async function authenticatedFetch(path, options = {}) {
    let accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    if (!accessToken) accessToken = await refreshAccessToken();
    if (!accessToken) throw new Error("Not authenticated");

    const request = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...EXTRA_REQUEST_HEADERS,
        "Content-Type": "application/json",
        ...(options.headers || {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (request.status !== 401) return request;

    const nextAccessToken = await refreshAccessToken();
    if (!nextAccessToken) return request;

    return fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...EXTRA_REQUEST_HEADERS,
        "Content-Type": "application/json",
        ...(options.headers || {}),
        Authorization: `Bearer ${nextAccessToken}`,
      },
    });
  }

  async function loadSavedItems() {
    if (!currentUser?.id) return;
    try {
      const response = await authenticatedFetch("/saved");
      if (!response.ok) return;
      const data = await response.json();
      const items = Array.isArray(data?.items) ? data.items.map(normalizeSavedItem) : [];
      setSavedItems(items);
    } catch (error) {
      // Keep current UI state if fetch fails.
    }
  }

  async function clearSession() {
    await clearTokens();
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
    setCurrentUser(null);
    setSavedItems([]);
  }

  useEffect(() => {
    if (__DEV__) {
      console.log("[API_BASE_URL]", API_BASE_URL);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      try {
        const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (storedUser && mounted) {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser?.id) setCurrentUser(parsedUser);
        }

        const refreshed = await refreshAccessToken();
        if (!refreshed && mounted) {
          await clearSession();
        }
      } catch (e) {
        if (mounted) await clearSession();
      } finally {
        if (mounted) setIsReady(true);
      }
    }
    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!currentUser?.id) {
      setSavedItems([]);
      return;
    }
    loadSavedItems();
  }, [currentUser?.id]);

  async function authenticateWithGoogle(idToken, intent = "signin") {
    setAuthLoading(true);
    setAuthError("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/google/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...EXTRA_REQUEST_HEADERS },
        body: JSON.stringify({ idToken, intent }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || (intent === "signup" ? "Google sign-up failed" : "Google sign-in failed"));
      }

      await storeTokens(data.accessToken, data.refreshToken);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      setCurrentUser(data.user);
      const items = Array.isArray(data?.items) ? data.items.map(normalizeSavedItem) : [];
      setSavedItems(items);
      return data.user;
    } catch (error) {
      setAuthError(
        `${error?.message || (intent === "signup" ? "Could not create account" : "Could not sign in")} (API: ${API_BASE_URL})`
      );
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }

  async function loginWithGoogle(idToken) {
    return authenticateWithGoogle(idToken, "signin");
  }

  async function signupWithGoogle(idToken) {
    return authenticateWithGoogle(idToken, "signup");
  }

  async function loginWithPassword({ email, password }) {
    setAuthLoading(true);
    setAuthError("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...EXTRA_REQUEST_HEADERS },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Could not sign in");
      }
      await storeTokens(data.accessToken, data.refreshToken);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      setCurrentUser(data.user);
      return data.user;
    } catch (error) {
      setAuthError(`${error?.message || "Could not sign in"} (API: ${API_BASE_URL})`);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }

  async function signupWithPassword({ name, email, password, avatarUrl, phone, country }) {
    setAuthLoading(true);
    setAuthError("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...EXTRA_REQUEST_HEADERS },
        body: JSON.stringify({ name, email, password, avatarUrl, phone, country }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Could not create account");
      }
      await storeTokens(data.accessToken, data.refreshToken);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      setCurrentUser(data.user);
      return data.user;
    } catch (error) {
      setAuthError(`${error?.message || "Could not create account"} (API: ${API_BASE_URL})`);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }

  async function completeProfile({ phone, country }) {
    const response = await authenticatedFetch("/me/profile", {
      method: "PATCH",
      body: JSON.stringify({ phone, country }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.message || "Could not save profile details");
    }
    if (data?.user) {
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      setCurrentUser(data.user);
    }
    return data?.user || null;
  }

  async function logout() {
    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...EXTRA_REQUEST_HEADERS },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch (error) {
      // Allow local logout even if API logout fails.
    } finally {
      await clearSession();
    }
  }

  async function deleteAccount() {
    if (!currentUser?.id) return;
    try {
      const response = await authenticatedFetch("/me", { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || "Could not delete account");
      }
    } finally {
      await clearSession();
    }
  }

  function isSaved(mediaType, id) {
    return savedItems.some((item) => item.mediaType === mediaType && String(item.id) === String(id));
  }

  async function toggleSaved(item) {
    if (!currentUser?.id) return;
    const mediaType = item.mediaType;
    const itemId = String(item.id);
    const alreadySaved = isSaved(mediaType, itemId);

    if (alreadySaved) {
      const response = await authenticatedFetch(`/saved/${mediaType}/${itemId}`, { method: "DELETE" });
      if (response.ok) {
        setSavedItems((prev) =>
          prev.filter((entry) => !(entry.mediaType === mediaType && String(entry.id) === itemId))
        );
      }
      return;
    }

    const payload = {
      mediaType,
      tmdbId: itemId,
      title: item.title || "Untitled",
      posterPath: item.posterPath || null,
      releaseDate: item.date || "",
    };
    const response = await authenticatedFetch("/saved", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!response.ok) return;
    const data = await response.json();
    if (!data?.item) return;
    const normalized = normalizeSavedItem(data.item);
    setSavedItems((prev) => [normalized, ...prev]);
  }

  async function saveToLibrary(item) {
    if (!currentUser?.id) {
      throw new Error("Please sign in to save items.");
    }

    const mediaType = item?.mediaType;
    const itemId = String(item?.id || "");
    if (!mediaType || !itemId) {
      throw new Error("Invalid item details.");
    }

    if (isSaved(mediaType, itemId)) {
      return { status: "already_saved" };
    }

    const payload = {
      mediaType,
      tmdbId: itemId,
      title: item.title || "Untitled",
      posterPath: item.posterPath || null,
      releaseDate: item.date || item.releaseDate || "",
    };

    const response = await authenticatedFetch("/saved", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.message || "Could not save item.");
    }
    if (!data?.item) {
      throw new Error("Could not save item.");
    }

    const normalized = normalizeSavedItem(data.item);
    setSavedItems((prev) => {
      const exists = prev.some(
        (entry) => entry.mediaType === normalized.mediaType && String(entry.id) === String(normalized.id)
      );
      return exists ? prev : [normalized, ...prev];
    });
    return { status: "saved", item: normalized };
  }

  const value = useMemo(
    () => ({
      isReady,
      currentUser,
      savedItems,
      authLoading,
      authError,
      loginWithGoogle,
      signupWithGoogle,
      loginWithPassword,
      signupWithPassword,
      completeProfile,
      logout,
      deleteAccount,
      isSaved,
      toggleSaved,
      saveToLibrary,
    }),
    [authError, authLoading, currentUser, isReady, savedItems]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) throw new Error("useAppState must be used inside AppStateProvider");
  return value;
}
