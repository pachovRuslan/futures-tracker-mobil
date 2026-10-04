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
import * as Crypto from "expo-crypto";
import Constants from "expo-constants";
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

// ─────────────────────────────────────────────────────────────────────────────
// Таймауты сетевых запросов
//
// ⚠️ История бага: у supabase-js НЕТ таймаута по умолчанию — на флакающей
// мобильной сети (5G с потерями пакетов, DPI, кривой IPv6 оператора) запрос
// мог висеть бесконечно. Симптом: вечный спиннер «Загрузка дашборда…» без
// ошибки и без кнопки «Повторить». AbortController превращает зависание в
// обычную ошибку за конечное время — экраны уже умеют её показывать.
//
// Данные (PostgREST/RPC): 15с — достаточно для 1 RTT + полезная нагрузка.
// Auth (/auth/v1/*): 60с — обмен PKCE-кода на медленной сети занимает
// десятки секунд (экран /auth/callback обещает «до минуты» и имеет
// собственный жёсткий потолок 60с — таймауты синхронизированы).
// ─────────────────────────────────────────────────────────────────────────────
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
// Redirect URI для OAuth
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Схема приложения (app.json → "scheme"). Именно она зарегистрирована в
 * intent-filter'ах dev- и standalone-сборок — только по ней браузер может
 * вернуть пользователя в приложение.
 */
const APP_SCHEME = (() => {
  const scheme = Constants.expoConfig?.scheme;
  const first = Array.isArray(scheme) ? scheme[0] : scheme;
  return first ?? "futurestracker";
})();

/** Путь OAuth-callback — соответствует роуту app/auth/callback.tsx. */
const REDIRECT_PATH = "auth/callback";

// ─────────────────────────────────────────────────────────────────────────────
// Глобальный перехват OAuth-callback URL (warm start)
// ─────────────────────────────────────────────────────────────────────────────
//
// Проблема: когда приложение уже запущено (warm start), deep link
// futurestracker://auth/callback?code=... приходит СОБЫТИЕМ Linking "url" в
// тот момент, когда экран /auth/callback ещё НЕ смонтирован (пользователь на
// /login). Событие получают только слушатели, зарегистрированные на момент его
// прихода: expo-router (он навигирует на /auth/callback) и этот глобальный
// слушатель. useEffect экрана регистрирует свой слушатель УЖЕ ПОСЛЕ события и
// не видит URL; Linking.getInitialURL() на warm start свежий URL тоже не
// возвращает. Код авторизации терялся, 5-секундный таймаут уводил на /login —
// «бесконечный логин».
//
// Решение: слушатель на уровне модуля. Модуль auth.ts вычисляется при старте
// приложения (через импорт app/_layout.tsx → AuthContext → auth.ts), поэтому
// слушатель зарегистрирован ЗАРАНЕЕ и не может пропустить событие. URL
// складывается в переменную, а экран /auth/callback забирает его при
// монтировании (см. consumePendingCallbackUrl).
// ─────────────────────────────────────────────────────────────────────────────

let pendingCallbackUrl: string | null = null;

if (Platform.OS !== "web") {
  Linking.addEventListener("url", ({ url }) => {
    if (url.includes(`/${REDIRECT_PATH}`)) {
      pendingCallbackUrl = url;
    }
  });
}

/**
 * Возвращает и сбрасывает URL OAuth-callback, перехваченный глобальным
 * слушателем (warm start). null — если перехваченного URL нет.
 */
export function consumePendingCallbackUrl(): string | null {
  const url = pendingCallbackUrl;
  pendingCallbackUrl = null;
  return url;
}

/**
 * URL, хост-часть которого — «сырой» IP (LAN-адрес дев-сервера).
 *
 * Supabase (GoTrue) отклоняет такие redirect URL СТРУКТУРНО — ещё ДО проверки
 * allowlist: разрешены только loopback-адреса (RFC 8252 §7.3), см.
 * supabase/auth → internal/utilities/request.go → IsRedirectURLValid.
 * Отклонённый redirect_to молча заменяется на Site URL → браузер уезжает
 * на сайт, и «возврата в приложение» не происходит.
 */
const IP_HOST_RE = /^[a-z][a-z0-9+.-]*:\/\/\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:\/|$)/i;

/**
 * Возвращает redirect URI для текущего окружения:
 *  - web:                     https://<origin>/auth/callback
 *  - Expo Go (tunnel):        exp://u.expo.dev/<projectId>/--/auth/callback
 *  - Expo Go (LAN):           exp://<LAN-IP>:8081/--/auth/callback — Supabase
 *                             такой URL не примет никогда (см. IP_HOST_RE),
 *                             нужен --tunnel либо dev-сборка
 *  - dev-сборка / standalone: futurestracker://auth/callback
 *
 * ⚠️ КАЖДЫЙ из этих URL должен быть добавлен в Supabase Dashboard →
 * Authentication → URL Configuration → Redirect URLs.
 */
export function getRedirectUri(): string {
  // Web: makeRedirectUri вернёт window.location.origin + "/auth/callback".
  if (Platform.OS === "web") {
    return makeRedirectUri({ path: REDIRECT_PATH });
  }

  // Expo Go: приложение физически не владеет схемой futurestracker:// и не
  // может её перехватить — единственный рабочий вариант это exp://
  // (makeRedirectUri сам подставит hostUri дев-сервера и префикс "/--/",
  // т.к. Expo Go исполняется как storeClient).
  if (isRunningInExpoGo()) {
    return makeRedirectUri({ path: REDIRECT_PATH });
  }

  // Dev-сборка (expo-dev-client) и standalone. makeRedirectUri тут
  // использовать НЕЛЬЗЯ: в SDK 57 dev-сборка тоже исполняется как storeClient
  // (ExecutionEnvironment.StoreClient = «Expo Go **или** development build»),
  // где expo-linking всегда резолвит схему "exp" и приклеивает hostUri
  // дев-сервера — на выходе ссылка вида exp://192.168.1.3:8081auth/callback,
  // которую dev-сборка не может перехватить, а Supabase — принять. Строим
  // ссылку сами: user-схема из app.json в dev/standalone сборке
  // зарегистрирована манифестом.
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

  // ─── Expo Go по LAN: Supabase отклонит redirect ещё до allowlist ────
  // (IP-хост не loopback) и молча подставит Site URL — браузер уедет на
  // сайт, возврата в приложение не будет. Ловим это ДО открытия браузера
  // и объясняем, что делать, вместо непрозрачного «редирект на сайт».
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

  // ─── Dev-сборка / standalone: системный браузер + deep link ────────────────
  if (!isRunningInExpoGo()) {
    const canOpen = await Linking.canOpenURL(data.url);
    if (!canOpen) throw new Error("Не удаётся открыть браузер для авторизации");
    await Linking.openURL(data.url);
    return;
  }

  // ─── Expo Go (только tunnel/localhost): встроенная auth-сессия ──────
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
// Sign in with Apple (iOS) — требование App Store Guideline 4.8
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ленивый доступ к expo-apple-authentication: нативный модуль существует
 * только на iOS. На Android/web не вычисляем его вовсе (require внутри
 * платформенной ветки — Metro всё равно положит код в бандл для iOS,
 * но на Android модуль не будет исполнен).
 */
export function getAppleAuthentication():
  | typeof import("expo-apple-authentication")
  | null {
  if (Platform.OS !== "ios") return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-apple-authentication");
}

/**
 * Вход через Apple: identity token верифицируется на сервере Supabase
 * (signInWithIdToken), nonce связывает запрос с токеном (Supabase хеширует
 * rawNonce и сверяет с claim'ом `nonce` внутри Apple ID token).
 */
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
    // nonce — параметр верхнего уровня credentials (supabase-js):
    // сервер хеширует его и сверяет с claim'ом `nonce` внутри токена.
    nonce: rawNonce,
  });
  if (error) throw error;
  // Сессия установится через onAuthStateChange → AuthProvider → redirect.
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
