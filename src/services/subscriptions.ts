/**
 * Subscriptions service — упрощённая версия.
 *
 * In-App Purchases (RevenueCat) отключены. Premium-статус определяется
 * только через БД Supabase (см. src/services/entitlements.ts).
 *
 * Чтобы вернуть In-App Purchases в будущем:
 *   1. npx expo install react-native-purchases
 *   2. eas build --profile development (нужен dev-клиент, Expo Go не подойдёт)
 *   3. Реализовать initSubscriptions(), getOfferings(), purchaseProduct()
 *   4. Включить флаг в useSubscription или entitlements.
 *
 * Сейчас файл оставлен для обратной совместимости с импортами в _layout.tsx
 * и paywall.tsx.
 */

export async function initSubscriptions(): Promise<void> {
  if (__DEV__) {
    console.log("[Subscriptions] Init skipped — RevenueCat disabled (DB-only premium)");
  }
}

export async function refreshSubscriptionState(): Promise<void> {
  // no-op — premium-статус управляется через entitlements.ts
}

export function isPremiumUser(): boolean {
  return false;
}

export async function purchaseProduct(_productIdentifier: string): Promise<boolean> {
  if (__DEV__) {
    console.warn("[Subscriptions] purchaseProduct: RevenueCat disabled");
  }
  return false;
}

export async function restorePurchases(): Promise<boolean> {
  if (__DEV__) {
    console.warn("[Subscriptions] restorePurchases: RevenueCat disabled");
  }
  return false;
}

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

export async function getOfferings(): Promise<Offerings> {
  return { all: {} };
}
