/**
 * auth — публичный API авторизации (баррель).
 *
 * Слои: персистентность сессии — ./storage, Supabase-клиент и операции
 * сессии — ./client, OAuth-флоу Google — ./oauth, Sign in with Apple —
 * ./apple.
 *
 * Внутренние детали (safeStorage, чанкинг SecureStore, exchangedCodes)
 * наружу не светятся — импортеры `@/services/auth` видят только то,
 * что переэкспортировано ниже.
 */

export { getSupabase, signOut, getAccessToken } from "./client";
export {
  parseOAuthParams,
  consumePendingCallbackUrl,
  getRedirectUri,
  describeOAuthError,
  signInWithGoogle,
  exchangeCodeOnce,
} from "./oauth";
export { getAppleAuthentication, signInWithApple } from "./apple";
