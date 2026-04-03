import axios from "axios";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const DEFAULT_TMDB_REGION = "CA";

function getAuthConfig() {
 
  const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY;

  
  const readToken = process.env.EXPO_PUBLIC_TMDB_READ_TOKEN;

  if (readToken) return { kind: "bearer", value: readToken };
  if (apiKey) return { kind: "apiKey", value: apiKey };
  return { kind: "missing", value: "" };
}

const client = axios.create({
  baseURL: TMDB_BASE_URL,
  timeout: 15000,
});

export async function tmdbGet(path, params = {}) {
  const auth = getAuthConfig();
  if (auth.kind === "missing") {
    throw new Error("Missing TMDB credentials. Set EXPO_PUBLIC_TMDB_API_KEY (preferred) or EXPO_PUBLIC_TMDB_READ_TOKEN.");
  }
  const res = await client.get(path, {
    headers: auth.kind === "bearer" ? { Authorization: `Bearer ${auth.value}` } : undefined,
    params: {
      language: "en-US",
      ...params,
      ...(auth.kind === "apiKey" ? { api_key: auth.value } : {}),
    },
  });
  return res.data;
}

function normalizeRegion(raw) {
  const value = String(raw || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : "";
}

export function getTmdbRegion(explicitRegion) {
  const fromArg = normalizeRegion(explicitRegion);
  if (fromArg) return fromArg;

  const fromEnv = normalizeRegion(process.env.EXPO_PUBLIC_TMDB_REGION);
  if (fromEnv) return fromEnv;

  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || "";
    const parts = String(locale).replace("_", "-").split("-");
    const candidate = normalizeRegion(parts[parts.length - 1] || "");
    if (candidate) return candidate;
  } catch (error) {
    // Ignore locale detection failures and fall back.
  }

  return DEFAULT_TMDB_REGION;
}

export function getPosterUrl(posterPath) {
  if (!posterPath) return null;
  return `https://image.tmdb.org/t/p/w185${posterPath}`;
}

export async function fetchMovies(subType, page = 1, options = {}) {
  const region = getTmdbRegion(options?.region);
  const params = { page };
  if (region) params.region = region;
  return tmdbGet(`/movie/${subType}`, params);
}

export async function fetchTv(subType, page = 1, options = {}) {
  const region = getTmdbRegion(options?.region);
  const params = { page };
  if (region) params.region = region;
  return tmdbGet(`/tv/${subType}`, params);
}

export async function fetchSearch(searchType, query, page = 1, options = {}) {
  const region = getTmdbRegion(options?.region);
  const params = { query, page, include_adult: false };
  if (region) params.region = region;
  return tmdbGet(`/search/${searchType}`, params);
}

export async function fetchMovieById(movieId) {
  return tmdbGet(`/movie/${movieId}`);
}

export async function fetchMovieReleaseDates(movieId) {
  return tmdbGet(`/movie/${movieId}/release_dates`);
}

export async function fetchTvById(tvId) {
  return tmdbGet(`/tv/${tvId}`);
}

export async function fetchTrending(mediaType = "all", timeWindow = "week", page = 1) {
  return tmdbGet(`/trending/${mediaType}/${timeWindow}`, { page });
}

export async function fetchByGenre(mediaType, genreId, page = 1) {
  return tmdbGet(`/discover/${mediaType}`, {
    page,
    with_genres: genreId,
    sort_by: "popularity.desc",
  });
}


