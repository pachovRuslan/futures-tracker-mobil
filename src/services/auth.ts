import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/config";
import { createClient } from "@supabase/supabase-js";
import { makeRedirectUri } from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import "react-native-url-polyfill/auto"; // ВАЖНО: должен быть первым

const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (
        typeof SecureStore !== "undefined" &&
        typeof SecureStore.getItemAsync === "function"
      ) {
        return await SecureStore.getItemAsync(key);
      }
    } catch (e) {}
    return null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (
        typeof SecureStore !== "undefined" &&
        typeof SecureStore.setItemAsync === "function"
      ) {
        return await SecureStore.setItemAsync(key, value);
      }
    } catch (e) {}
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (
        typeof SecureStore !== "undefined" &&
        typeof SecureStore.deleteItemAsync === "function"
      ) {
        return await SecureStore.deleteItemAsync(key);
      }
    } catch (e) {}
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

  if (Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUrl },
    });
    if (error) throw error;
    return null;
  } else {
    // Телефон: используем PKCE Flow
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

    // Открываем встроенный браузер
    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    if (res.type !== "success") throw new Error("Auth cancelled");

    // Парсим URL, который вернулся
    const url = new URL(res.url);
    const code = url.searchParams.get("code");

    if (!code) throw new Error("No auth code in redirect URL");

    // Обмениваем код на сессию
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

