import {
  isSupabaseConfigured,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from "@/shared/config";
import {
  createClient,
  type Session,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { isRunningInExpoGo } from "expo";
import { makeRedirectUri } from "expo-auth-session";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { Linking, Platform } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Storage для сессии Supabase (web → localStorage, native → SecureStore)
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️ expo-secure-store имеет жёсткий лимит 2048 байт на значение. Сессия
// Supabase c провайдерскими токенами Google может его превышать — на Android
// такое значение молча теряется, и сессия «не прилипает» (пользователь
// разлогинивается после перезапуска). Поэтому длинные значения режутся на
// чанки по 2000 символов и собираются обратно при чтении.
// ─────────────────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 2000;
const chunkKey = (key: string, i: number) => `${key}__${i}`;
const chunksMetaKey = (key: string) => `${key}__chunks`;

async function secureGet(key: string): Promise<string | null> {
  const meta = await SecureStore.getItemAsync(chunksMetaKey(key));
  if (meta == null) return SecureStore.getItemAsync(key);

  const n = Number.parseInt(meta, 10);
  if (!Number.isFinite(n) || n <= 0) return null;

  // ⚠️ История оптимизации: чанки читались ПОСЛЕДОВАТЕЛЬНО — 3 чанка
  // сессии = 3 подряд операции Android Keystore (аппаратное шифрование,
  // ~200-600мс каждая) — заметная часть «Вход в систему…» при каждом
  // запуске. Операции независимы — читаем параллельно.
  const parts = await Promise.all(
    Array.from({ length: n }, (_, i) =>
      SecureStore.getItemAsync(chunkKey(key, i)),
    ),
  );
  const value = parts.join("");
  return value || null;
}

async function secureSet(key: string, value: string): Promise<void> {
  await secureRemove(key);

  if (value.length <= CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value);
    return;
  }

  const n = Math.ceil(value.length / CHUNK_SIZE);
  await SecureStore.setItemAsync(chunksMetaKey(key), String(n));
  // Запись чанков параллельно — независимые операции Keystore (см.
  // комментарий в secureGet).
  await Promise.all(
    Array.from({ length: n }, (_, i) =>
      SecureStore.setItemAsync(
        chunkKey(key, i),
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      ),
    ),
  );
}

async function secureRemove(key: string): Promise<void> {
  const meta = await SecureStore.getItemAsync(chunksMetaKey(key));
  if (meta != null) {
    const n = Number.parseInt(meta, 10);
    if (Number.isFinite(n)) {
      // Параллельное удаление (см. secureGet) — ошибки «ключа нет»
      // подавляем как и раньше.
      await Promise.all(
        Array.from({ length: n }, (_, i) =>
          SecureStore.deleteItemAsync(chunkKey(key, i)).catch(() => {}),
        ),
      );
    }
    try {
      await SecureStore.deleteItemAsync(chunksMetaKey(key));
    } catch {
      // ключа нет — ок
    }
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ключа нет — ок
  }
}

const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.localStorage) {
          return window.localStorage.getItem(key);
        }
        return null;
      }
      return await secureGet(key);
    } catch (e) {
      if (__DEV__) console.warn("[auth] storage.getItem error:", e);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
        return;
      }
      await secureSet(key, value);
    } catch (e) {
      if (__DEV__) console.warn("[auth] storage.setItem error:", e);
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
      await secureRemove(key);
    } catch (e) {
      if (__DEV__) console.warn("[auth] storage.removeItem error:", e);
    }
  },
};

let supabaseClient: SupabaseClient | null = null;

const DATA_TIMEOUT_MS = 15_000;
const AUTH_TIMEOUT_MS = 60_000;

function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const ms = String(input).includes("/auth/v1/")
    ? AUTH_TIMEOUT_MS
    : DATA_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
  });
}

export function getSupabase(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase не сконфигурирован: задайте EXPO_PUBLIC_SUPABASE_URL и " +
        "EXPO_PUBLIC_SUPABASE_ANON_KEY в .env (см. README.md) и перезапустите " +
        "dev-сервер с --clear.",
    );
  }

  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { fetch: fetchWithTimeout },
    auth: {
      storage: safeStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === "web",
      flowType: "pkce",
    },
  });
  return supabaseClient;
}

export function parseOAuthParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const m = url.match(/[?#](.*)$/);
  if (!m) return params;
  for (const pair of m[1].split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const k = eq === -1 ? pair : pair.slice(0, eq);
    const v = eq === -1 ? "" : pair.slice(eq + 1);
    try {
      params[decodeURIComponent(k)] = decodeURIComponent(v);
    } catch {
      params[k] = v;
    }
  }
  return params;
}

const APP_SCHEME = (() => {
  const scheme = Constants.expoConfig?.scheme;
  const first = Array.isArray(scheme) ? scheme[0] : scheme;
  return first ?? "futurestracker";
})();

const REDIRECT_PATH = "auth/callback";

let pendingCallbackUrl: string | null = null;

if (Platform.OS !== "web") {
  Linking.addEventListener("url", ({ url }) => {
    if (url.includes(`/${REDIRECT_PATH}`)) {
      pendingCallbackUrl = url;
    }
  });
}

export function consumePendingCallbackUrl(): string | null {
  const url = pendingCallbackUrl;
  pendingCallbackUrl = null;
  return url;
}

const IP_HOST_RE =
  /^[a-z][a-z0-9+.-]*:\/\/\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:\/|$)/i;

export function getRedirectUri(): string {
  if (Platform.OS === "web") {
    return makeRedirectUri({ path: REDIRECT_PATH });
  }

  if (isRunningInExpoGo()) {
    return makeRedirectUri({ path: REDIRECT_PATH });
  }

  return `${APP_SCHEME}://${REDIRECT_PATH}`;
}

export function describeOAuthError(params: Record<string, string>): string {
  const code = params.error_code ?? params.error;
  const desc = params.error_description ?? params.error;
  if (code === "403" || /not allowed|callback/i.test(desc ?? "")) {
    return (
      "Supabase отклонил redirect (403 / Callback URL not allowed). " +
      "Добавьте текущий redirect URI в Supabase Dashboard → Authentication → " +
      "URL Configuration → Redirect URLs (URI см. в консоли выше)."
    );
  }
  return `Вход не выполнен: ${code ?? "unknown"} — ${desc ?? "нет описания"}`;
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = getSupabase();
  const redirectUrl = getRedirectUri();

  if (Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUrl },
    });
    if (error) throw error;
    return;
  }

  if (__DEV__) {
    console.log(
      "[Auth] redirect URI (должен быть в Supabase → Auth → Redirect URLs):",
      redirectUrl,
    );
  }

  if (isRunningInExpoGo() && IP_HOST_RE.test(redirectUrl)) {
    throw new Error(
      `Expo Go по LAN-адресу не работает с Supabase: redirect "${redirectUrl}" ` +
        "содержит IP-хост, который Supabase отклоняет до проверки allowlist " +
        "(разрешён только localhost). Запустите дев-сервер с туннелем " +
        "(npx expo start --tunnel) и добавьте в Supabase Redirect URLs запись вида " +
        "exp://u.expo.dev/<projectId>/--/auth/callback, либо используйте " +
        "dev-сборку (eas build --profile development) — для неё redirect " +
        "futurestracker://auth/callback уже настроен.",
    );
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error("Supabase не вернул OAuth URL");

  if (!isRunningInExpoGo()) {
    const canOpen = await Linking.canOpenURL(data.url);
    if (!canOpen) throw new Error("Не удаётся открыть браузер для авторизации");
    await Linking.openURL(data.url);
    return;
  }

  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

  if (res.type === "cancel" || res.type === "dismiss") {
    return;
  }

  if (res.type !== "success" || !("url" in res) || !res.url) {
    return;
  }

  if (__DEV__) console.log("[Auth] callback URL:", res.url);

  const params = parseOAuthParams(res.url);

  if (params.error) {
    throw new Error(describeOAuthError(params));
  }

  if (!params.code) {
    throw new Error(
      "Supabase вернул redirect без кода авторизации. Проверьте, что redirect " +
        `URI "${redirectUrl}" добавлен в Supabase → Auth → Redirect URLs.`,
    );
  }

  await exchangeCodeOnce(params.code);
}

const exchangedCodes = new Set<string>();

async function waitForSession(timeoutMs: number): Promise<Session | null> {
  const supabase = getSupabase();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) return session;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

export async function exchangeCodeOnce(code: string): Promise<User | null> {
  const supabase = getSupabase();

  if (exchangedCodes.has(code)) {
    const session = await waitForSession(6000);
    if (session?.user) return session.user;
    throw new Error("Таймаут ожидания сессии после обмена кода");
  }

  exchangedCodes.add(code);

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.user;
  } catch (e) {
    const session = await waitForSession(1500);
    if (session?.user) return session.user;
    throw e;
  }
}

export function getAppleAuthentication():
  | typeof import("expo-apple-authentication")
  | null {
  if (Platform.OS !== "ios") return null;
  return require("expo-apple-authentication");
}

export async function signInWithApple(): Promise<void> {
  const Apple = getAppleAuthentication();
  if (!Apple) {
    throw new Error("Sign in with Apple доступен только на iOS");
  }

  const available = await Apple.isAvailableAsync();
  if (!available) {
    throw new Error(
      "Apple ID не настроен на устройстве (Настройки → [имя] → Вход с Apple).",
    );
  }

  const rawNonce = Crypto.randomUUID().replace(/-/g, "");
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  const credential = await Apple.signInAsync({
    requestedScopes: [
      Apple.AppleAuthenticationScope.FULL_NAME,
      Apple.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) {
    throw new Error("Apple не вернул identity token — попробуйте ещё раз");
  }

  const supabase = getSupabase();
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
}

export async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  return session?.access_token ?? null;
}
