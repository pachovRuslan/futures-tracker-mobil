import { getAccessToken } from "@/services/auth";
import {
  API_URL,
  getRevenueCatApiKey,
} from "@/shared/config";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";
import { Platform } from "react-native";

/**
 * Мост между RevenueCat (покупки в сторе) и серверной таблицей
 * user_entitlements (откуда useSubscription читает статус Premium).
 *
 * Поток покупки:
 *   1. paywall вызывает getPremiumPackages() → RC-офферинг с ценами стора;
 *   2. purchasePremium(pkg) → нативный флоу Google Play / App Store;
 *   3. syncEntitlementToServer() → POST /api/billing/sync-entitlement на
 *      сайте. СЕРВЕР сам переспрашивает RC v1 API про app_user_id
 *      (= supabase user id) и пишет user_entitlements — клиент не может
 *      «нарисовать» себе премиум;
 *   4. useSubscription.refresh(true) перечитывает entitlement → весь app
 *      видит Premium.
 *
 * Тот же sync-entitlement вызывается при каждом запуске (initPurchases) —
 * так продления/отмены доезжают без webhook'ов.
 *
 * RC-ключи берутся из EXPO_PUBLIC_REVENUECAT_{IOS,ANDROID}_KEY. Пока ключи
 * не заданы, всё API деградирует в no-op (isBillingAvailable() = false) —
 * paywall показывает заглушку. Это kill-switch биллинга без редеплоя БД.
 */

let configured = false;
let lastLoggedInUserId: string | null = null;

/** Биллинг сконфигурирован для текущей платформы. */
export function isBillingAvailable(): boolean {
  return getRevenueCatApiKey() !== null;
}

/**
 * Инициализация RC и привязка к аккаунту. Вызывается из AuthContext при
 * появлении user.id. Повторные вызовы безопасны: configure — один раз,
 * logIn — только при смене юзера.
 */
export async function initPurchases(userId: string): Promise<void> {
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) return;

  try {
    if (!configured) {
      Purchases.configure({ apiKey });
      if (__DEV__) {
        await Purchases.setLogLevel(LOG_LEVEL.VERBOSE).catch(() => {});
      }
      configured = true;
    }

    if (lastLoggedInUserId !== userId) {
      await Purchases.logIn(userId);
      lastLoggedInUserId = userId;
      // Фоновая сверка: продления/отмены с прошлого запуска.
      void syncEntitlementToServer().catch(() => {});
    }
  } catch (e) {
    if (__DEV__) console.warn("[purchases] init error:", e);
  }
}

/** Выход из RC при разлогине (вызывается из AuthContext.logout). */
export async function resetPurchases(): Promise<void> {
  if (!configured || !lastLoggedInUserId) return;
  try {
    await Purchases.logOut();
  } catch (e) {
    if (__DEV__) console.warn("[purchases] logOut error:", e);
  } finally {
    lastLoggedInUserId = null;
  }
}

/** Пакеты Premium из текущего офферинга RC (цены — из стора). */
export async function getPremiumPackages(): Promise<PurchasesPackage[]> {
  if (!configured) return [];
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

/**
 * Покупка. Отмена юзером НЕ пробрасывается как ошибка — paywall сам
 * различает её по флагу userCancelled у пойманного исключения.
 */
export async function purchasePremium(
  pkg: PurchasesPackage,
): Promise<CustomerInfo> {
  const result = await Purchases.purchasePackage(pkg);
  return result.customerInfo;
}

/** «Восстановить покупки» — обязательная кнопка для App Store. */
export async function restorePremium(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

/**
 * Сверить подписку с сервером: сервер опрашивает RC и обновляет
 * user_entitlements. Возвращает итоговый premium-статус.
 */
export async function syncEntitlementToServer(): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${API_URL}/api/billing/sync-entitlement`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ platform: Platform.OS }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`sync-entitlement: HTTP ${res.status}`);
    }

    const data = (await res.json()) as { premium?: boolean };
    return Boolean(data.premium);
  } finally {
    clearTimeout(timer);
  }
}
