import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/config";
import { createClient } from "@supabase/supabase-js";
import { makeRedirectUri } from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import { Linking, Platform } from "react-native";

// ВАЖНО: НЕ импортируем "react-native-url-polyfill/auto" — в RN 0.86 + Hermes
// это вызывает JSI crash (assertion "isObject()" failed в jsi.h:2014).
// В RN 0.86 глобальный URL уже встроен, polyfill не нужен.

// ─────────────────────────────────────────────────────────────────────────────
// Safe storage (web → localStorage, native → SecureStore)
// ─────────────────────────────────────────────────────────────────────────────
//
// ВАЖНО: ранее на вебе safeStorage был no-op (getItem возвращал null, setItem
// ничего не делал). Это ломало persistence сессии Supabase: после SIGNED_IN
// сессия не сохранялась, и следующий getSession() возвращал null — приложение
// "забывало" пользователя при перезагрузке страницы или новом монтировании.
// Теперь на вебе используется localStorage.

const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === "web") {
        // На вебе localStorage может быть недоступен в SSR / инкогнито.
        if (typeof window !== "undefined" && window.localStorage) {
          return window.localStorage.getItem(key);
        }
        return null;
      }
      if (SecureStore?.getItemAsync) {
        return await SecureStore.getItemAsync(key);
      }
    } catch (e) {
      console.warn("[safeStorage] getItem error:", e);
    }
    return null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
        return;
      }
      if (SecureStore?.setItemAsync) {
        return await SecureStore.setItemAsync(key, value);
      }
    } catch (e) {
      console.warn("[safeStorage] setItem error:", e);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(key);
        }
        return;
      }
      if (SecureStore?.deleteItemAsync) {
        return await SecureStore.deleteItemAsync(key);
      }
    } catch (e) {
      console.warn("[safeStorage] removeItem error:", e);
    }
  },
};

// Экспортируем safeStorage для использования в других модулях (api.ts).
// На вебе использует localStorage, на нативе — SecureStore.
export { safeStorage };

// ─────────────────────────────────────────────────────────────────────────────
// Supabase client
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: safeStorage,
    autoRefreshToken: true,
    persistSession: true,
    // На вебе — true (парсит ?code из URL автоматически)
    // На мобильном — false (парсим вручную в signInWithGoogle)
    detectSessionInUrl: Platform.OS === "web",
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Sign in with Google
// ─────────────────────────────────────────────────────────────────────────────
//
// ВАЖНО: Этот код использует ручную реализацию OAuth с PKCE через
// Linking.openURL + Linking.addEventListener. Раньше использовался
// WebBrowser.openAuthSessionAsync, но в Expo Go на Android он открывает
// Custom Tab, который не перехватывает exp:// redirect и зависает.
//
// Flow:
// 1. Генерируем code_verifier и code_challenge (PKCE)
// 2. Получаем OAuth URL от Supabase с redirect_to = наш redirectUrl
// 3. Открываем системный браузер через Linking.openURL
// 4. Слушаем Linking.addEventListener("url", ...) — перехватываем redirect
// 5. Когда получаем URL с code=, обмениваем код на сессию
//
// ВАЖНО: Этот подход требует, чтобы redirectUrl был добавлен в Supabase
// Dashboard → Authentication → URL Configuration → Redirect URLs.

export async function signInWithGoogle() {
  const redirectUrl = makeRedirectUri({ path: "auth/callback" });
  console.log("[Auth] redirectUrl:", redirectUrl);
  console.log("[Auth] Platform.OS:", Platform.OS);

  // ─── WEB ────────────────────────────────────────────────────────────────
  if (Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUrl },
    });
    if (error) throw error;
    return null;
  }

  // ─── MOBILE (Expo Go + standalone) ──────────────────────────────────────
  // Получаем OAuth URL от Supabase с skipBrowserRedirect: true,
  // затем открываем его в системном браузере и ждём редиректа на redirectUrl.
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
  console.log("[Auth] OAuth URL (full):", data.url);

  // Открываем системный браузер и слушаем редирект.
  console.log("[Auth] Opening system browser via Linking.openURL...");

  return await new Promise<null>((resolve, reject) => {
    let resolved = false;
    const redirectBase = redirectUrl.split("?")[0];
    let timeoutId: ReturnType<typeof setTimeout>;

    const subscription = Linking.addEventListener("url", (event) => {
      console.log("[Auth] Linking event url:", event.url);
      if (resolved) return;

      const url = event.url ?? "";
      // Проверяем, что URL содержит code= (Supabase вернул OAuth-код).
      // Не проверяем startsWith(redirectBase), потому что на Android
      // redirect может прийти с другим форматом (например, с /--/ в середине).
      if (url.includes("code=")) {
        resolved = true;
        subscription.remove();
        clearTimeout(timeoutId);
        console.log("[Auth] Got OAuth code, finalizing session...");
        finalizeSessionFromUrl(url)
          .then(() => resolve(null))
          .catch(reject);
      } else {
        console.log(
          "[Auth] Ignoring URL (no code=):",
          url.slice(0, 100),
        );
      }
    });

    // Открываем системный браузер
    Linking.openURL(data.url).catch((e: unknown) => {
      if (!resolved) {
        resolved = true;
        subscription.remove();
        clearTimeout(timeoutId);
        console.error("[Auth] Linking.openURL failed:", e);
        reject(e);
      }
    });

    // Timeout 3 минуты
    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        subscription.remove();
        console.error("[Auth] Timeout waiting for OAuth redirect");
        reject(new Error("Auth timeout — no redirect received in 3 minutes"));
      }
    }, 180000);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Finalize session from URL (used on mobile)
// ─────────────────────────────────────────────────────────────────────────────

async function finalizeSessionFromUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    const code = parsedUrl.searchParams.get("code");

    console.log("[Auth] finalizeSessionFromUrl url:", url.slice(0, 120));
    console.log("[Auth] code:", code ? "found" : "not found");

    if (!code) {
      // Может уже есть сессия (auto-parsed)
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session?.user ?? null;
    }

    const { data: session, error: sessionError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (sessionError) throw sessionError;

    if (session.session?.access_token) {
      await safeStorage.setItem("access_token", session.session.access_token);
      await safeStorage.setItem("refresh_token", session.session.refresh_token);
      console.log("[Auth] Session saved to storage");
    }

    return session.user;
  } catch (e) {
    console.error("[Auth] finalizeSessionFromUrl error:", e);
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign out / getters
// ─────────────────────────────────────────────────────────────────────────────

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
