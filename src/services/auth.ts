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
import { makeRedirectUri } from "expo-auth-session";
import Constants, { ExecutionEnvironment } from "expo-constants";
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

  let value = "";
  for (let i = 0; i < n; i++) {
    value += (await SecureStore.getItemAsync(chunkKey(key, i))) ?? "";
  }
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
  for (let i = 0; i < n; i++) {
    await SecureStore.setItemAsync(
      chunkKey(key, i),
      value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
    );
  }
}

async function secureRemove(key: string): Promise<void> {
  const meta = await SecureStore.getItemAsync(chunksMetaKey(key));
  if (meta != null) {
    const n = Number.parseInt(meta, 10);
    if (Number.isFinite(n)) {
      for (let i = 0; i < n; i++) {
        try {
          await SecureStore.deleteItemAsync(chunkKey(key, i));
        } catch {
          // ключа нет — ок
        }
      }
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

// ─────────────────────────────────────────────────────────────────────────────
// Supabase client — ленивый singleton
// ─────────────────────────────────────────────────────────────────────────────
//
// Раньше createClient() вызывался на уровне модуля. Если .env не задан,
// supabase-js бросает "supabaseUrl is required" ПРЯМО ПРИ ИМПОРТЕ — до
// монтирования ErrorBoundary, и приложение падает белым экраном без
// объяснений. Ленивая инициализация позволяет показать экран ошибки
// конфигурации вместо крэша.
// ─────────────────────────────────────────────────────────────────────────────

let supabaseClient: SupabaseClient | null = null;

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
    auth: {
      storage: safeStorage,
      autoRefreshToken: true,
      persistSession: true,
      // На native URL сессии парсим сами (expo-router deep link), на web —
      // пусть supabase-js заберёт ?code= из window.location.
      detectSessionInUrl: Platform.OS === "web",
      flowType: "pkce",
    },
  });
  return supabaseClient;
}

// ─────────────────────────────────────────────────────────────────────────────
// Парсинг OAuth-параметров из redirect URL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Разбирает параметры из query (?a=1) и fragment (#a=1) части URL.
 * new URL() на RN/Hermes плохо парсит custom scheme (exp://) — поэтому regex.
 */
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

// ─────────────────────────────────────────────────────────────────────────────
// Sign in with Google
// ─────────────────────────────────────────────────────────────────────────────

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Возвращает redirect URI для текущего окружения:
 *  - web:              http://localhost:8081/auth/callback
 *  - Expo Go:          exp://<LAN-IP>:8081/--/auth/callback
 *  - dev/standalone:   futurestracker://auth/callback
 *
 * ⚠️ КАЖДЫЙ из этих URL должен быть добавлен в Supabase Dashboard →
 * Authentication → URL Configuration → Redirect URLs. Это самая частая
 * причина «веб работает, в Expo Go — нет»: exp://-URL не добавлен, Supabase
 * реджектит redirect, и браузер остаётся висеть на ошибке.
 */
export function getRedirectUri(): string {
  // Путь оставляем дефолтным: в Expo Go makeRedirectUri сам подставит
  // scheme `exp` и префикс `--` для expo-router. Явно передавать
  // scheme: "futurestracker" НЕЛЬЗЯ — Expo Go не сможет перехватить
  // чужой scheme, и браузер не вернёт пользователя в приложение.
  return makeRedirectUri({ path: "auth/callback" });
}

function describeOAuthError(params: Record<string, string>): string {
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

  // ─── WEB: полная переадресация браузера ──────────────────────────────────
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

  // ─── NATIVE: получаем OAuth URL и открываем сами ─────────────────────────
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
      // NOTE: access_type=offline / prompt=consent убраны — это cargo-cult из
      // туториалов Google. Supabase сам управляет refresh-токенами, а
      // prompt=consent заставлял показывать экран согласия при каждом входе.
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error("Supabase не вернул OAuth URL");

  // ─── Standalone / dev-client: системный браузер + deep link ──────────────
  if (!isExpoGo) {
    const canOpen = await Linking.canOpenURL(data.url);
    if (!canOpen) throw new Error("Не удаётся открыть браузер для авторизации");
    await Linking.openURL(data.url);
    return;
  }

  // ─── Expo Go: встроенная auth-сессия ──────────────────────────────────────
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

  if (res.type === "cancel" || res.type === "dismiss") {
    // Пользователь закрыл браузер — это не ошибка, просто выходим.
    return;
  }

  if (res.type !== "success" || !("url" in res) || !res.url) {
    return;
  }

  if (__DEV__) console.log("[Auth] callback URL:", res.url);

  const params = parseOAuthParams(res.url);

  if (params.error) {
    // Раньше этот случай молча игнорировался — пользователь нажимал «Войти»,
    // браузер закрывался, и ничего не происходило (см. REFACTORING.md, баг №2).
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

// ─────────────────────────────────────────────────────────────────────────────
// Обмен OAuth code на сессию (защита от двойного обмена)
// ─────────────────────────────────────────────────────────────────────────────
//
// PKCE-код одноразовый. В Expo Go redirect обрабатывают ДВА потребителя:
//  1) обещание openAuthSessionAsync в signInWithGoogle;
//  2) экран /auth/callback, на который навигирует expo-router по deep link.
// Раньше оба вызывали exchangeCodeForSession с одним кодом — второй вызов
// падал с 400 invalid_request, и login показывал «Ошибка входа» при
// фактически установленной сессии. exchangeCodeOnce дедуплицирует коды:
// кто первый — тот и обменивает; второй ждёт появления сессии.
// ─────────────────────────────────────────────────────────────────────────────

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
    // Код уже обменивается другим обработчиком — ждём сессию.
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
    // Код мог быть расходован конкурентным путём — если сессия всё же
    // установилась, считаем вход успешным.
    const session = await waitForSession(1500);
    if (session?.user) return session.user;
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign out / access token
// ─────────────────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
}

export async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  return session?.access_token ?? null;
}
