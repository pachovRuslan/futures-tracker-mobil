/**
 * auth — публичный API авторизации (баррель). Бог-сервис
 * src/services/auth.ts (428 строк) разбит по слоям: персистентность
 * сессии — ./storage, Supabase-клиент и операции сессии — ./client,
 * OAuth-флоу Google — ./oauth, Sign in with Apple — ./apple.
 *
 * Все импортеры `@/services/auth` не менялись: спецификатор теперь
 * резолвится в этот index.ts. Набор экспортов — тот же, что у
 * бог-файла; внутренние детали (safeStorage, чанкинг SecureStore,
 * exchangedCodes) наружу не светятся.
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
