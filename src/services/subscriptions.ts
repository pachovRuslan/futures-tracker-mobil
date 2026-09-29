/**
 * Subscriptions service — упрощённая версия без RevenueCat.
 *
 * Раньше здесь использовался react-native-purchases (нативный модуль),
 * который НЕ работает в Expo Go и вызывает краш при загрузке бандла.
 * Даже dynamic import() не помогает — Metro всё равно включает модуль в bundle.
 *
 * Теперь премиум определяется только через БД (Supabase RPC get_my_entitlement),
 * что уже работает (см. src/services/entitlements.ts).
 *
 * Если в будущем понадобится In-App Purchases через Google Play / App Store,
 * нужно будет собрать development build (eas build --profile development)
 * и вернуть react-native-purchases.
 */

export type PurchaseFeature = "pro" | "auto_sync" | "unlimited_trades";

export interface SubscriptionState {
  isPremium: boolean;
  features: Set<PurchaseFeature>;
  expiresAt: Date | null;
  rawData?: unknown;
}

export type CustomerInfoListener = (state: SubscriptionState) => void;

export interface OfferingPackage {
  identifier: string;
  productIdentifier: string;
  title: string;
  description: string;
  priceString: string;
  price: number;
  currencyCode: string;
  packageType: string;
}

export interface Offerings {
  current?: {
    identifier: string;
    availablePackages: OfferingPackage[];
  };
  all: Record<string, { availablePackages: OfferingPackage[] }>;
}

// Состояние (всегда FREE на уровне RevenueCat — реальный статус берётся из БД).
let _currentState: SubscriptionState = {
  isPremium: false,
  features: new Set(),
  expiresAt: null,
};
const _listeners = new Set<CustomerInfoListener>();

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Инициализация. Без RevenueCat — no-op.
 * Безопасна для повторного вызова.
 */
export async function initSubscriptions(): Promise<void> {
  console.log("[Subscriptions] Init skipped — RevenueCat disabled (DB-only premium)");
}

/**
 * Текущее состояние подписки. Синхронно, безопасно вызывать когда угодно.
 */
export function getSubscriptionState(): SubscriptionState {
  return _currentState;
}

/**
 * Проверка фичи. Синхронно. false = фича недоступна.
 * Реальный статус берётся из БД через useSubscription → checkPremiumStatus.
 */
export function hasFeature(feature: PurchaseFeature): boolean {
  return _currentState.features.has(feature);
}

/**
 * Сокращение для самого частого запроса — isPremium.
 */
export function isPremiumUser(): boolean {
  return _currentState.isPremium;
}

/**
 * Подписка на обновления состояния. Возвращает функцию отписки.
 * Listener сработает сразу с текущим состоянием.
 */
export function addSubscriptionListener(cb: CustomerInfoListener): () => void {
  _listeners.add(cb);
  try {
    cb(_currentState);
  } catch (e) {
    console.warn("[Subscriptions] listener initial call error:", e);
  }
  return () => {
    _listeners.delete(cb);
  };
}

/**
 * Принудительно обновить состояние. Без RevenueCat — no-op.
 * Реальный статус обновляется через useSubscription.refresh().
 */
export async function refreshSubscriptionState(): Promise<SubscriptionState> {
  return _currentState;
}

/**
 * Покупка продукта. Без RevenueCat — заглушка.
 */
export async function purchaseProduct(
  _productIdentifier: string,
): Promise<boolean> {
  console.warn(
    "[Subscriptions] purchaseProduct: RevenueCat disabled. " +
      "Premium управляется через БД (admin panel в Supabase).",
  );
  return false;
}

/**
 * Восстановление покупок. Без RevenueCat — заглушка.
 */
export async function restorePurchases(): Promise<boolean> {
  console.warn("[Subscriptions] restorePurchases: RevenueCat disabled.");
  return false;
}

/**
 * Готово ли окружение для платных функций.
 * Без RevenueCat — всегда false (используем DB-премиум).
 */
export function isNativeSubscriptionsAvailable(): boolean {
  return false;
}

/**
 * Получить offerings. Без RevenueCat — пустой объект.
 */
export async function getOfferings(): Promise<Offerings> {
  console.log("[Subscriptions] getOfferings: RevenueCat disabled (no offerings)");
  return { all: {} };
}

/**
 * Совместимость со старым API.
 */
export async function getSubscriptionStatus(): Promise<boolean> {
  return isPremiumUser();
}
