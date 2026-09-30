import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/config";
import { createClient, type User } from "@supabase/supabase-js";
import { makeRedirectUri } from "expo-auth-session";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { Linking, Platform } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Safe storage (web → localStorage, native → SecureStore)
// ─────────────────────────────────────────────────────────────────────────────

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
    detectSessionInUrl: Platform.OS === "web",
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Sign in with Google — гибридный OAuth flow
// ─────────────────────────────────────────────────────────────────────────────

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Извлекает параметр code из URL любого формата (exp://, futurestracker://, https://). */
function extractCodeFromUrl(url: string): string | null {
  // Regex работает для всех URL форматов (exp://, futurestracker://, https://).
  // new URL() плохо парсит custom scheme на RN/Hermes — используем regex.
  const match = url.match(/[?&]code=([^&#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

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

  // ─── MOBILE (Expo Go + standalone) ──────────────────────────────────────
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
    console.log("[Auth] OAuth URL:", data.url.slice(0, 100) + "...");
    console.log("[Auth] isExpoGo:", isExpoGo);
  }

  if (isExpoGo) {
    // ─── Expo Go: WebBrowser.openAuthSessionAsync ─────────────────────────
    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    if (__DEV__) console.log("[Auth] WebBrowser result type:", res.type);

    if (res.type === "success" && "url" in res && res.url) {
      if (__DEV__)
        console.log("[Auth] WebBrowser result url:", res.url.slice(0, 200));
      const code = extractCodeFromUrl(res.url);
      if (code) {
        if (__DEV__) console.log("[Auth] Got code, exchanging for session...");
        try {
          await exchangeCodeForSession(code);
          if (__DEV__) console.log("[Auth] session established");
        } catch (e) {
          if (__DEV__) console.error("[Auth] exchangeCodeForSession error:", e);
          throw e;
        }
      } else {
        if (__DEV__)
          console.log("[Auth] no code in URL — Supabase вернул URL без code=");
      }
    } else if (res.type === "dismiss" || res.type === "cancel") {
      if (__DEV__)
        console.log(
          "[Auth] WebBrowser dismissed — пользователь закрыл браузер",
        );
    }
    return;
  }

  // ─── Standalone: Linking.openURL ────────────────────────────────────────
  const canOpen = await Linking.canOpenURL(data.url);
  if (!canOpen) {
    throw new Error("Не удаётся открыть браузер для авторизации");
  }
  await Linking.openURL(data.url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Exchange OAuth code for session
// ─────────────────────────────────────────────────────────────────────────────

export async function exchangeCodeForSession(
  code: string,
): Promise<User | null> {
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

export async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export { supabase };
