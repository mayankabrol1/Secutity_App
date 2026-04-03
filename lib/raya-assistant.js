import { fetchByGenre, fetchMovies, fetchSearch, fetchTrending, fetchTv } from "./tmdb";

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = "gpt-5.4-mini";
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "any",
  "are",
  "based",
  "best",
  "for",
  "from",
  "give",
  "i",
  "im",
  "in",
  "is",
  "it",
  "latest",
  "like",
  "me",
  "movie",
  "movies",
  "new",
  "of",
  "on",
  "or",
  "recent",
  "recommend",
  "recommendation",
  "recommendations",
  "show",
  "shows",
  "something",
  "suggest",
  "that",
  "the",
  "to",
  "trending",
  "tv",
  "want",
  "watch",
  "what",
  "with",
]);
const GENRE_HINTS = [
  "action",
  "adventure",
  "animation",
  "comedy",
  "crime",
  "documentary",
  "drama",
  "family",
  "fantasy",
  "history",
  "horror",
  "mystery",
  "romance",
  "sci-fi",
  "science",
  "thriller",
  "war",
];
const GENRE_TO_TMDB_IDS = {
  action: { movie: 28, tv: 10759 },
  adventure: { movie: 12, tv: 10759 },
  animation: { movie: 16, tv: 16 },
  comedy: { movie: 35, tv: 35 },
  crime: { movie: 80, tv: 80 },
  documentary: { movie: 99, tv: 99 },
  drama: { movie: 18, tv: 18 },
  family: { movie: 10751, tv: 10751 },
  fantasy: { movie: 14, tv: 10765 },
  history: { movie: 36, tv: null },
  horror: { movie: 27, tv: null },
  mystery: { movie: 9648, tv: 9648 },
  romance: { movie: 10749, tv: null },
  "sci-fi": { movie: 878, tv: 10765 },
  science: { movie: 878, tv: 10765 },
  thriller: { movie: 53, tv: null },
  war: { movie: 10752, tv: null },
};
const GENRE_ALIASES = {
  police: "crime",
  cop: "crime",
  cops: "crime",
  detective: "crime",
  detectives: "crime",
  procedural: "crime",
  investigation: "crime",
  investigations: "crime",
  supernatural: "horror",
  spooky: "horror",
  scary: "horror",
};

function normalizeItem(item, fallbackMediaType = "movie") {
  const mediaType = item?.media_type || fallbackMediaType;
  const title = item?.title || item?.name || item?.original_title || item?.original_name || "Untitled";
  const releaseDate = item?.release_date || item?.first_air_date || "";
  return {
    id: String(item?.id || ""),
    mediaType,
    title,
    releaseDate,
    popularity: typeof item?.popularity === "number" ? Number(item.popularity.toFixed(3)) : null,
    voteAverage: typeof item?.vote_average === "number" ? Number(item.vote_average.toFixed(2)) : null,
    overview: item?.overview || "",
    posterPath: item?.poster_path || null,
  };
}

function uniqueById(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = `${item.mediaType}:${item.id}`;
    if (!item.id || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function parseYear(dateValue) {
  if (!dateValue) return null;
  const year = Number(String(dateValue).slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function inferIntent(prompt) {
  const text = prompt.toLowerCase();
  const wantsTrending = /trending|popular|hot|right now|top/.test(text);
  const wantsRecent = /recent|latest|new|newest|this year|last year/.test(text);
  const wantsMovie = /\bmovie\b|\bmovies\b/.test(text);
  const wantsTv = /\btv\b|\bseries\b|\bshow\b|\bshows\b/.test(text);
  const mediaTypePref = wantsMovie && !wantsTv ? "movie" : wantsTv && !wantsMovie ? "tv" : "all";
  return { wantsTrending, wantsRecent, mediaTypePref };
}

function extractSearchTerms(prompt) {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const genreTerms = words.filter((word) => GENRE_HINTS.includes(word));
  const keywordTerms = words.filter((word) => !STOP_WORDS.has(word) && word.length > 2);
  const merged = [...genreTerms, ...keywordTerms];
  return [...new Set(merged)].slice(0, 3);
}

function itemMatchesMediaType(item, mediaTypePref) {
  if (mediaTypePref === "all") return true;
  return item.mediaType === mediaTypePref;
}

function scoreItem(item, intent, promptText, searchTerms) {
  if (!itemMatchesMediaType(item, intent.mediaTypePref)) return -999;
  const lowerTitle = item.title.toLowerCase();
  const lowerOverview = item.overview.toLowerCase();
  let score = 0;

  for (const term of searchTerms) {
    if (lowerTitle.includes(term)) score += 4;
    if (lowerOverview.includes(term)) score += 2;
  }

  if (intent.wantsTrending) score += (item.popularity || 0) / 80;
  if (intent.wantsRecent) {
    const year = parseYear(item.releaseDate);
    const currentYear = new Date().getFullYear();
    if (year && year >= currentYear - 3) score += 4;
    else score -= 1.5;
  }

  if (!intent.wantsTrending) score += (item.voteAverage || 0) / 4;
  if (promptText.includes("crime") && (lowerTitle.includes("crime") || lowerOverview.includes("crime"))) score += 2;

  return score;
}

function cleanAssistantText(text) {
  return text.replace(/\*\*/g, "").replace(/^#+\s*/gm, "").replace(/```/g, "").trim();
}

function formatAssistantText(text) {
  const cleaned = cleanAssistantText(text);
  if (!cleaned) return cleaned;

  const rawLines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!rawLines.length) return cleaned;

  const bulletPattern = /^(\d+[\).\s]+|[-*•.]\s+)/;
  const introLines = [];
  const bulletLines = [];
  const outroLines = [];

  for (const line of rawLines) {
    if (bulletPattern.test(line)) {
      bulletLines.push(line.replace(/^(\d+[\).\s]+|[-*•.]\s+)/, "").trim());
      continue;
    }
    if (!bulletLines.length) introLines.push(line);
    else outroLines.push(line);
  }

  // If the model did not return bullets, try converting sentence-style suggestions into bullets.
  if (!bulletLines.length) {
    const sentences = cleaned
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (sentences.length >= 3) {
      const intro = sentences.shift();
      const generatedBullets = sentences.slice(0, 5);
      const maybeOutro = sentences.slice(5).join(" ");
      return [intro, generatedBullets.map((line) => `• ${line}`).join("\n\n"), maybeOutro].filter(Boolean).join("\n\n");
    }

    return cleaned;
  }

  const intro = introLines.join(" ").replace(/\s+/g, " ").trim();
  const bullets = bulletLines.slice(0, 8).map((line) => `• ${line}`).join("\n\n");
  const outro = outroLines.join(" ").replace(/\s+/g, " ").trim();
  return [intro, bullets, outro].filter(Boolean).join("\n\n");
}

function normalizeGenreWord(word) {
  if (GENRE_ALIASES[word]) return GENRE_ALIASES[word];
  if (word === "science") return "sci-fi";
  return word;
}

function buildGenreRequests(intent, terms) {
  const requestedGenres = terms.map(normalizeGenreWord).filter((term) => GENRE_TO_TMDB_IDS[term]);
  if (!requestedGenres.length) return [];

  const mediaTargets = intent.mediaTypePref === "all" ? ["movie", "tv"] : [intent.mediaTypePref];
  const requests = [];
  for (const genre of requestedGenres) {
    const ids = GENRE_TO_TMDB_IDS[genre];
    for (const mediaType of mediaTargets) {
      const id = ids?.[mediaType];
      if (id) requests.push({ genre, mediaType, id });
    }
  }
  return requests;
}

async function buildGroundingData(userPrompt) {
  const query = userPrompt.trim();
  const intent = inferIntent(query);
  const searchTerms = extractSearchTerms(query);
  const primaryTerm = searchTerms[0] || "";
  const targetedSearchType = intent.mediaTypePref === "all" ? "multi" : intent.mediaTypePref;
  const genreRequests = buildGenreRequests(intent, searchTerms);

  const [trendingRes, moviesRes, tvRes, searchMultiRes, targetedSearchRes, ...genreResults] = await Promise.all([
    fetchTrending("all", "week", 1).catch(() => ({ results: [] })),
    fetchMovies("popular", 1).catch(() => ({ results: [] })),
    fetchTv("popular", 1).catch(() => ({ results: [] })),
    query ? fetchSearch("multi", query, 1).catch(() => ({ results: [] })) : Promise.resolve({ results: [] }),
    primaryTerm ? fetchSearch(targetedSearchType, primaryTerm, 1).catch(() => ({ results: [] })) : Promise.resolve({ results: [] }),
    ...genreRequests.map((req) => fetchByGenre(req.mediaType, req.id, 1).catch(() => ({ results: [] }))),
  ]);

  const trending = (trendingRes?.results || []).slice(0, 14).map((item) => normalizeItem(item));
  const popularMovies = (moviesRes?.results || []).slice(0, 10).map((item) => normalizeItem(item, "movie"));
  const popularTv = (tvRes?.results || []).slice(0, 10).map((item) => normalizeItem(item, "tv"));
  const searchMatches = (searchMultiRes?.results || [])
    .filter((item) => item?.media_type === "movie" || item?.media_type === "tv")
    .slice(0, 14)
    .map((item) => normalizeItem(item));
  const targetedMatches = (targetedSearchRes?.results || [])
    .filter((item) => item?.media_type === "movie" || item?.media_type === "tv")
    .slice(0, 14)
    .map((item) => normalizeItem(item));
  const genreMatches = genreResults
    .flatMap((res, index) => {
      const req = genreRequests[index];
      return (res?.results || []).slice(0, 10).map((item) => normalizeItem(item, req?.mediaType || "movie"));
    });

  const catalog = uniqueById([...genreMatches, ...targetedMatches, ...searchMatches, ...trending, ...popularMovies, ...popularTv]).slice(0, 80);
  const candidatePool = [...catalog]
    .sort((a, b) => scoreItem(b, intent, query.toLowerCase(), searchTerms) - scoreItem(a, intent, query.toLowerCase(), searchTerms))
    .slice(0, 20);
  const fallbackPool = uniqueById([...trending, ...popularMovies, ...popularTv]).slice(0, 20);

  return {
    query,
    intent,
    searchTerms,
    candidatePool,
    fallbackPool,
    sections: {
      trending: uniqueById(trending).slice(0, 12),
      popularMovies: uniqueById(popularMovies).slice(0, 10),
      popularTv: uniqueById(popularTv).slice(0, 10),
      searchMatches: uniqueById(searchMatches).slice(0, 12),
      targetedMatches: uniqueById(targetedMatches).slice(0, 12),
      genreMatches: uniqueById(genreMatches).slice(0, 16),
    },
  };
}

export async function askRaya(userPrompt, conversationHistory = []) {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OpenAI key. Add EXPO_PUBLIC_OPENAI_API_KEY to your .env.local.");
  }

  const grounding = await buildGroundingData(userPrompt);

  const systemPrompt = [
    "You are Raya, a friendly movie and TV recommendation assistant inside a React Native app.",
    "Use only titles from the provided data. Never invent titles or facts.",
    "Prefer tmdbData.candidatePool first. Use fallbackPool only when needed.",
    "Keep the tone conversational and natural.",
    "Do not use markdown syntax (no **, no #, no code blocks).",
    "Give 3 to 5 recommendations unless the user asks for a different count.",
    "Each recommendation should be one short sentence with title, type/year, and why it fits.",
    "Use clear spacing: one short intro line, then bullet points that start with '•', with a blank line between bullets.",
    "End with one short optional follow-up question if it helps narrow choices.",
    "If exact matches are limited, avoid negative wording and offer the closest good-fit options in a confident, helpful tone.",
  ].join(" ");

  const compactHistory = Array.isArray(conversationHistory)
    ? conversationHistory
        .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.text === "string")
        .slice(-16)
        .map((item) => ({
          role: item.role,
          text: item.text.replace(/\s+/g, " ").trim().slice(0, 320),
        }))
    : [];

  const userPayload = {
    conversationHistory: compactHistory,
    userRequest: userPrompt,
    tmdbData: grounding,
  };

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_output_tokens: 380,
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: JSON.stringify(userPayload) }] },
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || "Raya could not get a response right now.";
    throw new Error(message);
  }

  const text = data?.output_text?.trim();
  if (text) {
    return {
      text: formatAssistantText(text),
      recommendedItems: grounding.candidatePool.slice(0, 18),
    };
  }

  const fallbackText =
    data?.output?.[0]?.content?.find?.((c) => c?.type === "output_text")?.text?.trim?.() || "";
  if (fallbackText) {
    return {
      text: formatAssistantText(fallbackText),
      recommendedItems: grounding.candidatePool.slice(0, 18),
    };
  }

  throw new Error("Raya did not return a valid response.");
}
