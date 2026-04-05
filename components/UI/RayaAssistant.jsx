import { FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import { askRaya } from "../../lib/raya-assistant";
import { useAppState } from "../../lib/app-state";

function createInitialMessage() {
  return {
    id: "raya-welcome",
    role: "assistant",
    text:
      "Hey, I'm Raya. Ask me for movie or TV suggestions by mood, genre, or what's trending right now.",
  };
}

function extractAddCommand(input) {
  const text = String(input || "").trim();
  if (!text) return { shouldSave: false, title: "", useLast: false };

  if (/^(add|save)\s+(it|this|this one|that|that one)(\s+(to|in)\s+my\s+(saved\s+)?library)?[.!?]*$/i.test(text)) {
    return { shouldSave: true, title: "", useLast: true };
  }

  const fullMatch = text.match(
    /^(add|save)\s+["']?(.+?)["']?(\s+(to|in)\s+my\s+(saved\s+)?library)?[.!?]*$/i
  );
  if (fullMatch?.[2]) {
    return { shouldSave: true, title: fullMatch[2].trim(), useLast: false };
  }

  return { shouldSave: false, title: "", useLast: false };
}

function normalizeLookupTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\(\d{4}\)/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findRecommendationMatch(requestedTitle, pool) {
  const target = normalizeLookupTitle(requestedTitle);
  if (!target) return null;

  const scored = pool
    .map((item) => {
      const titleNorm = normalizeLookupTitle(item?.title);
      let score = 0;
      if (titleNorm === target) score += 120;
      if (titleNorm.startsWith(target) || target.startsWith(titleNorm)) score += 70;
      if (titleNorm.includes(target) || target.includes(titleNorm)) score += 45;
      const targetWords = target.split(" ").filter(Boolean);
      const titleWords = new Set(titleNorm.split(" ").filter(Boolean));
      const overlap = targetWords.filter((word) => titleWords.has(word)).length;
      score += overlap * 9;
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.item || null;
}

function mergeRecommendationPool(prev, next) {
  const items = Array.isArray(next) ? next : [];
  if (!items.length) return prev;

  const seen = new Set(prev.map((item) => `${item.mediaType}:${item.id}`));
  const merged = [...prev];
  for (const item of items) {
    const key = `${item?.mediaType}:${item?.id}`;
    if (!item?.id || !item?.mediaType || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged.slice(-60);
}

function RayaAvatar() {
  return (
    <View className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 items-center justify-center">
      <MaterialCommunityIcons name="movie-open" size={14} color="#ffffff" />
    </View>
  );
}

function UserAvatar({ uri }) {
  if (uri) {
    return <Image source={{ uri }} className="h-8 w-8 rounded-full border border-cyan-700" />;
  }
  return (
    <View className="h-8 w-8 rounded-full bg-cyan-700 border border-cyan-800 items-center justify-center">
      <FontAwesome name="user" size={12} color="#ffffff" />
    </View>
  );
}

function ChatMessageRow({ item, userPhotoUrl }) {
  const isAssistant = item.role === "assistant";
  const messageAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(messageAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [messageAnim]);

  return (
    <Animated.View
      style={{
        opacity: messageAnim,
        transform: [
          {
            translateY: messageAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [8, 0],
            }),
          },
        ],
      }}
      className={`flex-row items-end gap-2 ${isAssistant ? "justify-start" : "justify-end"}`}
    >
      {isAssistant ? <RayaAvatar /> : null}
      <View className={`${isAssistant ? "bg-gray-200" : "bg-cyan-500"} rounded-2xl px-4 py-3 max-w-[78%]`}>
        <Text className={isAssistant ? "text-gray-900" : "text-white"}>{item.text}</Text>
      </View>
      {!isAssistant ? <UserAvatar uri={userPhotoUrl || ""} /> : null}
    </Animated.View>
  );
}

export default function RayaAssistant() {
  const { currentUser, isSaved, saveToLibrary } = useAppState();
  const [open, setOpen] = useState(false);
  const [showIntroBubble, setShowIntroBubble] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([createInitialMessage()]);
  const listRef = useRef(null);
  const chatSessionRef = useRef(0);
  const recommendationPoolRef = useRef([]);
  const lastRecommendedRef = useRef(null);
  const introTimeoutRef = useRef(null);
  const introDelayTimeoutRef = useRef(null);
  const welcomedUserRef = useRef("");
  const introAnimRef = useRef(new Animated.Value(0));
  const closePressScale = useRef(new Animated.Value(1)).current;

  const canShow = !!currentUser?.id && !!currentUser?.profileComplete;

  const modalTitle = useMemo(() => "Raya", []);

  useEffect(() => {
    return () => {
      if (introTimeoutRef.current) clearTimeout(introTimeoutRef.current);
      if (introDelayTimeoutRef.current) clearTimeout(introDelayTimeoutRef.current);
    };
  }, []);

  function hideIntroBubble(animated = true) {
    if (introTimeoutRef.current) clearTimeout(introTimeoutRef.current);
    if (introDelayTimeoutRef.current) clearTimeout(introDelayTimeoutRef.current);
    if (!animated) {
      setShowIntroBubble(false);
      introAnimRef.current.setValue(0);
      return;
    }
    introAnimRef.current.stopAnimation();
    Animated.timing(introAnimRef.current, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setShowIntroBubble(false);
    });
  }

  function showIntroWithAnimation() {
    setShowIntroBubble(true);
    introAnimRef.current.setValue(0);
    Animated.parallel([
      Animated.timing(introAnimRef.current, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }

  useEffect(() => {
    if (!canShow) {
      hideIntroBubble(false);
      welcomedUserRef.current = "";
      return;
    }

    const userId = String(currentUser?.id || "");
    if (!userId || welcomedUserRef.current === userId) return;

    welcomedUserRef.current = userId;
    if (introDelayTimeoutRef.current) clearTimeout(introDelayTimeoutRef.current);
    if (introTimeoutRef.current) clearTimeout(introTimeoutRef.current);
    introDelayTimeoutRef.current = setTimeout(() => {
      showIntroWithAnimation();
      introTimeoutRef.current = setTimeout(() => {
        hideIntroBubble(true);
      }, 10000);
    }, 3000);
  }, [canShow, currentUser?.id]);

  function openAssistant() {
    hideIntroBubble(false);
    setOpen(true);
  }

  function handleClosePressIn() {
    Animated.spring(closePressScale, {
      toValue: 1.14,
      useNativeDriver: true,
      speed: 24,
      bounciness: 6,
    }).start();
  }

  function handleClosePressOut() {
    Animated.spring(closePressScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 6,
    }).start();
  }

  function handleClosePress() {
    // Tiny delay so the press animation is visible before modal closes.
    setTimeout(() => closeAssistant(), 70);
  }

  function closeAssistant() {
    // Bump session so any in-flight reply for the old chat is ignored.
    chatSessionRef.current += 1;
    setOpen(false);
    setQuery("");
    setLoading(false);
    setMessages([createInitialMessage()]);
    recommendationPoolRef.current = [];
    lastRecommendedRef.current = null;
  }

  async function onSend() {
    const value = query.trim();
    if (!value || loading) return;
    const chatSessionAtSend = chatSessionRef.current;
    const historyForModel = messages
      .filter((item) => item?.id !== "raya-welcome")
      .slice(-16)
      .map((item) => ({ role: item.role, text: item.text }));
    const command = extractAddCommand(value);

    const userMessage = { id: `u-${Date.now()}`, role: "user", text: value };
    setMessages((prev) => [...prev, userMessage]);
    setQuery("");

    if (command.shouldSave) {
      const match = command.useLast
        ? lastRecommendedRef.current
        : findRecommendationMatch(command.title, recommendationPoolRef.current);
      if (!match) {
        const hint = recommendationPoolRef.current
          .slice(-8)
          .map((item) => item.title)
          .slice(0, 4)
          .join(", ");
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: hint
              ? `I could not match that title in recent recommendations. Try one of these: ${hint}.`
              : "I do not have a recent recommendation to save yet. Ask me for suggestions first, then say 'save it'.",
          },
        ]);
        return;
      }

      if (isSaved(match.mediaType, match.id)) {
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: "assistant", text: `${match.title} is already in your saved library.` },
        ]);
        return;
      }

      setLoading(true);
      try {
        const saveResult = await saveToLibrary({
          mediaType: match.mediaType,
          id: match.id,
          title: match.title,
          posterPath: match.posterPath || null,
          date: match.releaseDate || "",
        });
        if (chatSessionAtSend !== chatSessionRef.current) return;
        if (saveResult?.status === "already_saved") {
          setMessages((prev) => [
            ...prev,
            { id: `a-${Date.now()}`, role: "assistant", text: `${match.title} is already in your saved library.` },
          ]);
          return;
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: `Added ${match.title} to your saved library.`,
          },
        ]);
      } catch (error) {
        if (chatSessionAtSend !== chatSessionRef.current) return;
        setMessages((prev) => [
          ...prev,
          {
            id: `aerr-${Date.now()}`,
            role: "assistant",
            text: error?.message || "I could not add that title right now.",
          },
        ]);
      } finally {
        if (chatSessionAtSend !== chatSessionRef.current) return;
        setLoading(false);
      }
      return;
    }

    setLoading(true);

    try {
      const result = await askRaya(value, historyForModel);
      const reply = result?.text || "I could not generate a reply right now.";
      if (chatSessionAtSend !== chatSessionRef.current) return;
      recommendationPoolRef.current = mergeRecommendationPool(
        recommendationPoolRef.current,
        result?.recommendedItems || []
      );
      lastRecommendedRef.current = result?.recommendedItems?.[0] || lastRecommendedRef.current;
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", text: reply }]);
    } catch (error) {
      if (chatSessionAtSend !== chatSessionRef.current) return;
      setMessages((prev) => [
        ...prev,
        {
          id: `aerr-${Date.now()}`,
          role: "assistant",
          text: error?.message || "Sorry, I could not answer right now.",
        },
      ]);
    } finally {
      if (chatSessionAtSend !== chatSessionRef.current) return;
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 10);
    }
  }

  if (!canShow) return null;

  return (
    <>
      <Pressable
        onPress={openAssistant}
        className="absolute right-5 h-16 w-16 rounded-full items-center justify-center bg-slate-800 border border-slate-700"
        style={{ bottom: 92, elevation: 10, shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}
      >
        <MaterialCommunityIcons name="movie-open" size={24} color="#ffffff" />
      </Pressable>
      {showIntroBubble ? (
        <Animated.View
          style={{
            opacity: introAnimRef.current,
            transform: [
              {
                translateY: introAnimRef.current.interpolate({
                  inputRange: [0, 1],
                  outputRange: [8, 0],
                }),
              },
            ],
          }}
          className="absolute right-5 bottom-[166px]"
        >
          <Pressable
            onPress={() => hideIntroBubble(true)}
            className="max-w-[265px] bg-white border border-gray-200 rounded-2xl px-5 py-4"
            style={{ elevation: 12, shadowColor: "#000", shadowOpacity: 0.24, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}
          >
            <Text className="text-base text-gray-800">
              Hi, I am Raya. Ask me for movie or TV picks by mood, genre, or what is trending right now.
            </Text>
            <Text className="text-sm text-gray-500 mt-1">Tap to dismiss</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      <Modal visible={open} animationType="fade" transparent onRequestClose={closeAssistant}>
        <View className="flex-1">
          <Pressable className="absolute inset-0 bg-black/35" onPress={closeAssistant} />
          <View pointerEvents="box-none" className="flex-1 items-end justify-end pl-10 pr-4 pb-6 pt-20">
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
              style={{ width: "100%", maxWidth: 390 }}
            >
              <View className="bg-white rounded-3xl border border-gray-200 h-[86%] min-h-[430px] max-h-[760px] overflow-hidden">
              <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200">
                <View className="flex-row items-center gap-3">
                  <View className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 items-center justify-center">
                    <MaterialCommunityIcons name="movie-open" size={14} color="#ffffff" />
                  </View>
                  <Text className="text-lg font-semibold text-gray-900 ">{modalTitle}</Text>
                </View>
                <Pressable
                  onPressIn={handleClosePressIn}
                  onPressOut={handleClosePressOut}
                  onPress={handleClosePress}
                >
                  <Animated.View
                    className="h-9 w-9 items-center justify-center rounded-full bg-gray-200"
                    style={{ transform: [{ scale: closePressScale }] }}
                  >
                    <FontAwesome name="close" size={18} color="#111827" />
                  </Animated.View>
                </Pressable>
              </View>

              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14, gap: 10 }}
                renderItem={({ item }) => <ChatMessageRow item={item} userPhotoUrl={currentUser?.photoUrl || ""} />}
              />

              <View className="px-4 pt-2 pb-6 border-t border-gray-200">
                <View className="flex-row items-center gap-2">
                  <TextInput
                    className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-gray-900"
                    placeholder="Ask Raya for movie/TV suggestions..."
                    value={query}
                    onChangeText={setQuery}
                    editable={!loading}
                    onSubmitEditing={onSend}
                    returnKeyType="send"
                  />
                  <Pressable
                    onPress={onSend}
                    disabled={loading}
                    className="h-12 w-12 rounded-xl bg-cyan-500 items-center justify-center"
                    style={{ opacity: loading ? 0.6 : 1 }}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <FontAwesome name="paper-plane" size={16} color="#fff" />}
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>
    </>
  );
}
