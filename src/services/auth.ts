import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/config.ts";
import { createClient } from "@supabase/supabase-js";
import { makeRedirectUri } from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Безопасный адаптер для хранилища Supabase.
// На телефоне использует SecureStore, в браузере — localStorage,
// на сервере (Node.js при сборке) — память.
const memoryStorage: Record<string, string> = {};

const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (
        typeof window !== "undefined" &&
        typeof window.localStorage !== "undefined"
      ) {
        return window.localStorage.getItem(key);
      }
      if (
        typeof SecureStore !== "undefined" &&
        typeof SecureStore.getItemAsync === "function"
      ) {
        return await SecureStore.getItemAsync(key);
      }
    } catch (e) {
      // ignore
    }
    return memoryStorage[key] ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (
        typeof window !== "undefined" &&
        typeof window.localStorage !== "undefined"
      ) {
        return window.localStorage.setItem(key, value);
      }
      if (
        typeof SecureStore !== "undefined" &&
        typeof SecureStore.setItemAsync === "function"
      ) {
        return await SecureStore.setItemAsync(key, value);
      }
    } catch (e) {
      // ignore
    }
    memoryStorage[key] = value;
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (
        typeof window !== "undefined" &&
        typeof window.localStorage !== "undefined"
      ) {
        return window.localStorage.removeItem(key);
      }
      if (
        typeof SecureStore !== "undefined" &&
        typeof SecureStore.deleteItemAsync === "function"
      ) {
        return await SecureStore.deleteItemAsync(key);
      }
    } catch (e) {
      // ignore
    }
    delete memoryStorage[key];
  },
};

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: safeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export async function signInWithGoogle() {
  const redirectUrl = makeRedirectUri({ path: "auth/callback" });
  console.log("МОЙ REDIRECT URL:", redirectUrl);

  // Используем skipBrowserRedirect: true, чтобы контролировать процесс самим
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
  });

  if (error) throw error;

  if (Platform.OS === "web") {
    // ВЕБ: Принудительно делаем редирект страницы на URL Google
    if (data.url) {
      window.location.href = data.url;
    }
    return null; // Функция прервется здесь, страница перезагрузится
  } else {
    // ТЕЛЕФОН (Expo Go): Открываем встроенный браузер
    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    if (res.type !== "success") throw new Error("Auth cancelled");

    const url = new URL(res.url);
    const code = url.searchParams.get("code");
    if (!code) throw new Error("No auth code");

    const { data: session, error: sessionError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (sessionError) throw sessionError;

    if (session.session?.access_token) {
      await safeStorage.setItem("access_token", session.session.access_token);
      await safeStorage.setItem("refresh_token", session.session.refresh_token);
    }

    return session.user;
  }
}

export async function signOut() {
  await supabase.auth.signOut();
  await safeStorage.removeItem("access_token");
  await safeStorage.removeItem("refresh_token");
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export { supabase };

