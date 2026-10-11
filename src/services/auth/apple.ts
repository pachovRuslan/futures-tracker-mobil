import { getSupabase } from "./client";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

/**
 * apple — Sign in with Apple: raw nonce → SHA256, credential →
 * supabase.auth.signInWithIdToken. getAppleAuthentication возвращает
 * модуль только на iOS (иначе null).
 *
 * Выделено из src/services/auth.ts при декомпозиции бог-сервиса;
 * логика перенесена без изменений.
 */

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
