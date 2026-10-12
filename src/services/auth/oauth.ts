import { getSupabase } from "./client";
import type { Session, User } from "@supabase/supabase-js";
import { t } from "@/i18n";
import { isRunningInExpoGo } from "expo";
import { makeRedirectUri } from "expo-auth-session";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { Linking, Platform } from "react-native";

/**
 * oauth — OAuth-флоу Google (PKCE): redirect URI под платформу
 * (web/Expo Go/сборка), парсинг колбэка, обмен кода на сессию
 * (exchangeCodeOnce) и человекочитаемые описания ошибок Supabase.
 *
 * Побочный эффект на импорте: на native вешается Linking-listener на
 * url с /auth/callback — url копится в pendingCallbackUrl и забирается
 * экраном колбэка. exchangedCodes (защита от повторного обмена кода)
 * остался приватным для модуля.
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
    return t("auth.supabaseRedirect");
  }
  return t("auth.loginFailed", {
    code: code ?? "unknown",
    desc: desc ?? t("auth.noDesc"),
  });
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
  if (!data.url) throw new Error(t("auth.errNoOAuthUrl"));

  if (!isRunningInExpoGo()) {
    const canOpen = await Linking.canOpenURL(data.url);
    if (!canOpen) throw new Error(t("auth.errCantOpenBrowser"));
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
    throw new Error(t("auth.errRedirectNoCode", { url: redirectUrl }));
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
    throw new Error(t("auth.errSessionTimeout"));
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
