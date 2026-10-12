import {
  isSupabaseConfigured,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from "@/shared/config";
import { safeStorage } from "./storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

/**
 * client — Supabase-клиент: синглтон getSupabase (таймауты fetch: auth —
 * 60 с, данные — 15 с) и базовые операции сессии (getAccessToken/signOut).
 */

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

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
}

export async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  return session?.access_token ?? null;
}
