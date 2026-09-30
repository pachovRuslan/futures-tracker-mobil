import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/config";
import { createClient, type User } from "@supabase/supabase-js";
import { makeRedirectUri } from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import { Linking, Platform } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Safe storage (web → localStorage, native → SecureStore)
// ─────────────────────────────────────────────────────────────────────────────
//
// На вебе localStorage может быть недоступен в SSR / инкогнито.
// На native SecureStore имеет лимит 2 KB на значение — сессия Supabase
// влезает, но при росте user_metadata может упереться. Если это случится,
// придётся перейти на AsyncStorage для storage (с пометкой о меньшей безопасности).

interface SafeStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

const safeStorage: SafeStorage = {
  getItem: async (key) => {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.localStorage) {
          return window.localStorage.getItem(key);
        }
        return null;
      }
      if (SecureStore?.getItemAsync) {
        return await SecureStore.getItemAsync(key);
      }
    } catch (e) {
      if (__DEV__) console.warn("[safeStorage] getItem error:", e);
    }
    return null;
  },
  setItem: async (key, value) => {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
        return;
      }
      if (SecureStore?.setItemAsync) {
        await SecureStore.setItemAsync(key, value);
      }
    } catch (e) {
      if (__DEV__) console.warn("[safeStorage] setItem error:", e);
    }
  },
  removeItem: async (key) => {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(key);
        }
        return;
      }
      if (SecureStore?.deleteItemAsync) {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (e) {
      if (__DEV__) console.warn("[safeStorage] removeItem error:", e);
    }
  },
};

export { safeStorage };

// ─────────────────────────────────────────────────────────────────────────────
// Supabase client
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: safeStorage,
    autoRefreshToken: true,
    persistSession: true,
    // На вебе — true (парсит ?code из URL автоматически).
    // На native — false: код обменивается в app/auth/callback.tsx через
    // supabase.auth.exchangeCodeForSession(code) с использованием useLocalSearchParams.
    detectSessionInUrl: Platform.OS === "web",
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Sign in with Google
// ─────────────────────────────────────────────────────────────────────────────
//
// Flow на native (Expo Go + standalone):
//   1. Получаем OAuth URL от Supabase с skipBrowserRedirect: true.
//   2. Открываем системный браузер через Linking.openURL.
//   3. После OAuth Supabase редиректит на futurestracker://auth/callback?code=...
//   4. Expo Router открывает app/auth/callback.tsx, который через
//      useLocalSearchParams() получает code и обменивает его на сессию.
//
// ВАЖНО: эта функция НЕ обменивает код на сессию. Это делает callback.tsx.
// Здесь мы только открываем браузер. Сессия установится через
// supabase.auth.onAuthStateChange SIGNED_IN, который слушает AuthProvider.

export async function signInWithGoogle(): Promise<void> {
  const redirectUrl = makeRedirectUri({ path: "auth/callback" });
  if (__DEV__) console.log("[Auth] redirectUrl:", redirectUrl);

  // ─── WEB ────────────────────────────────────────────────────────────────
  if (Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUrl },
    });
    if (error) throw error;
    return;
  }

  // ─── MOBILE ─────────────────────────────────────────────────────────────
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error("Supabase не вернул OAuth URL");

  if (__DEV__) {
    // Логируем без code_challenge и state — они не секретные, но лишние.
    console.log("[Auth] OAuth URL:", data.url.slice(0, 100) + "...");
  }

  // Открываем системный браузер. После OAuth пользователь вернётся в приложение
  // через intent (futurestracker://...), Expo Router откроет callback.tsx.
  const canOpen = await Linking.canOpenURL(data.url);
  if (!canOpen) {
    throw new Error("Не удаётся открыть браузер для авторизации");
  }
  await Linking.openURL(data.url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Exchange OAuth code for session (вызывается из app/auth/callback.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export async function exchangeCodeForSession(code: string): Promise<User | null> {
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return data.user;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign out / getters
// ─────────────────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Возвращает текущий access_token из сессии Supabase.
 * Используется в api.ts для Bearer-заголовка.
 */
export async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export { supabase };
