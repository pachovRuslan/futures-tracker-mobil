import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Безопасная обёртка над RevenueCat.
 *
 * Поддерживаем 4 окружения:
 *  - Expo Go              → заглушка (нативный модуль недоступен)
 *  - Web                  → Browser Mode (если задан PUBLIC ключ) или заглушка
 *  - Standalone iOS/Android → нативный RevenueCat
 *  - Development Build    → нативный RevenueCat
 *
 * Гарантии:
 *  - Любой метод можно вызывать ДО initSubscriptions — вернётся safe default.
 *  - Двойной вызов initSubscriptions безопасен.
 *  - Отсутствие API key не падает, просто отключает премиум.
 *  - Listeners автоматически снимаются при unavailable платформе.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Типы (без импорта нативного модуля — чтобы не падал Expo Go)
// ─────────────────────────────────────────────────────────────────────────────
export async function getSubscriptionStatus(): Promise<boolean> {
  await initSubscriptions();
  return isPremiumUser();
}
export type PurchaseFeature = "pro" | "auto_sync" | "unlimited_trades";

export interface SubscriptionState {
  isPremium: boolean;
  features: Set<PurchaseFeature>;
  expiresAt: Date | null;
  rawData?: unknown;
}

export type CustomerInfoListener = (state: SubscriptionState) => void;

interface PurchasesModule {
  configure: (opts: { apiKey: string; appUserID?: string }) => unknown;
  getCustomerInfo: () => Promise<{
    entitlements: {
      active: Record<
        string,
        {
          identifier: string;
          expirationDate: string | null;
          productIdentifier: string;
        }
      >;
      all: Record<string, unknown>;
    };
    originalAppUserId: string;
  }>;
  addCustomerInfoUpdateListener: (cb: (info: unknown) => void) => unknown;
  removeCustomerInfoUpdateListener: (cb: (info: unknown) => void) => void;
  purchaseStoreProduct: (params: unknown) => Promise<unknown>;
  restorePurchases: () => Promise<unknown>;
  setLogLevel: (level: string) => void;
  LOG_LEVEL: {
    DEBUG: string;
    INFO: string;
    WARNING: string;
    ERROR: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Определение окружения
// ─────────────────────────────────────────────────────────────────────────────

const isExpoGo = Constants.executionEnvironment === "store";
const isWeb = Platform.OS === "web";
const isStandaloneNative = !isExpoGo && !isWeb;

// На standalone/web RevenueCat включается только если задан ключ
const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
const hasApiKey =
  typeof REVENUECAT_API_KEY === "string" && REVENUECAT_API_KEY.length > 10;

// На вебе нужен отдельный PUBLIC ключ (с префиксом `appl_`, `goog_` не подойдёт)
// Если задаёшь `EXPO_PUBLIC_REVENUECAT_WEB_KEY`, будет использован он.
const REVENUECAT_WEB_KEY = process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY;
const hasWebKey =
  typeof REVENUECAT_WEB_KEY === "string" && REVENUECAT_WEB_KEY.length > 10;

const isRevenueCatAvailable =
  (isStandaloneNative && hasApiKey) || (isWeb && hasWebKey);

// ─────────────────────────────────────────────────────────────────────────────
// Состояние
// ─────────────────────────────────────────────────────────────────────────────

let _initialized = false;
let _initPromise: Promise<void> | null = null;
let _purchases: PurchasesModule | null = null;
let _currentState: SubscriptionState = {
  isPremium: false,
  features: new Set(),
  expiresAt: null,
};
const _listeners = new Set<CustomerInfoListener>();
const _nativeListeners = new WeakMap<
  CustomerInfoListener,
  (info: unknown) => void
>();

// Маппинг entitlement → features (настраивай под свои продукты в RevenueCat)
const ENTITLEMENT_TO_FEATURES: Record<string, PurchaseFeature[]> = {
  pro: ["pro", "auto_sync", "unlimited_trades"],
  premium: ["pro", "auto_sync", "unlimited_trades"],
  auto_sync: ["auto_sync"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Утилиты
// ─────────────────────────────────────────────────────────────────────────────

function parseStateFromCustomerInfo(info: unknown): SubscriptionState {
  try {
    const i = info as {
      entitlements?: {
        active?: Record<
          string,
          {
            identifier: string;
            expirationDate: string | null;
            productIdentifier: string;
          }
        >;
      };
    };

    const active = i.entitlements?.active ?? {};
    const entitlementIds = Object.keys(active);
    const features = new Set<PurchaseFeature>();
    let expiresAt: Date | null = null;

    for (const id of entitlementIds) {
      const feats = ENTITLEMENT_TO_FEATURES[id] ?? [];
      feats.forEach((f) => features.add(f));

      const ent = active[id];
      if (ent?.expirationDate) {
        const d = new Date(ent.expirationDate);
        if (!isNaN(d.getTime()) && (!expiresAt || d > expiresAt)) {
          expiresAt = d;
        }
      }
    }

    return {
      isPremium: entitlementIds.length > 0,
      features,
      expiresAt,
      rawData: info,
    };
  } catch (e) {
    console.warn("[Subscriptions] parseState error:", e);
    return {
      isPremium: false,
      features: new Set(),
      expiresAt: null,
      rawData: info,
    };
  }
}

function notifyListeners() {
  for (const cb of _listeners) {
    try {
      cb(_currentState);
    } catch (e) {
      console.warn("[Subscriptions] listener error:", e);
    }
  }
}

async function loadPurchasesModule(): Promise<PurchasesModule | null> {
  if (!isRevenueCatAvailable) return null;

  try {
    // Динамический импорт — Expo Go не упадёт на этапе require
    const mod = await import("react-native-purchases");
    return (mod.default ?? mod) as PurchasesModule;
  } catch (e) {
    console.warn("[Subscriptions] Failed to load react-native-purchases:", e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Инициализация RevenueCat. Безопасна для повторного вызова.
 * Безопасна для Expo Go / Web / отсутствия API key.
 */
export function initSubscriptions(): Promise<void> {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    if (!isRevenueCatAvailable) {
      console.log(
        `[Subscriptions] Skipped init — unavailable environment ` +
          `(expoGo=${isExpoGo}, web=${isWeb}, hasKey=${hasApiKey}, hasWebKey=${hasWebKey})`,
      );
      _initialized = true;
      return;
    }

    try {
      _purchases = await loadPurchasesModule();
      if (!_purchases) {
        console.warn("[Subscriptions] Module not loaded");
        _initialized = true;
        return;
      }

      // Минимальный лог для dev
      if (__DEV__ && _purchases.setLogLevel) {
        try {
          _purchases.setLogLevel(_purchases.LOG_LEVEL?.INFO ?? "INFO");
        } catch {
          /* ignore */
        }
      }

      const apiKey = isWeb ? REVENUECAT_WEB_KEY : REVENUECAT_API_KEY;
      _purchases.configure({ apiKey: apiKey as string });

      // Подписываемся на обновления
      _purchases.addCustomerInfoUpdateListener((info) => {
        _currentState = parseStateFromCustomerInfo(info);
        notifyListeners();
      });

      // Первичная загрузка состояния
      try {
        const info = await _purchases.getCustomerInfo();
        _currentState = parseStateFromCustomerInfo(info);
        notifyListeners();
      } catch (e) {
        console.warn("[Subscriptions] getCustomerInfo failed:", e);
      }

      _initialized = true;
      console.log("[Subscriptions] RevenueCat initialized successfully");
    } catch (e) {
      console.error(
        "[Subscriptions] Init failed (continuing without premium):",
        e,
      );
      _initialized = true;
    }
  })();

  return _initPromise;
}

/**
 * Текущее состояние подписки. Синхронно, безопасно вызывать когда угодно.
 */
export function getSubscriptionState(): SubscriptionState {
  return _currentState;
}

/**
 * Проверка фичи. Синхронно. false = фича недоступна.
 */
export function hasFeature(feature: PurchaseFeature): boolean {
  return _currentState.features.has(feature);
}

/**
 * Сокращение для最常见的 isPremium.
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

  // Сразу пушим текущее состояние
  try {
    cb(_currentState);
  } catch (e) {
    console.warn("[Subscriptions] listener initial call error:", e);
  }

  // Если нативный модуль доступен — обернём и зарегистрируем
  if (_purchases) {
    const nativeCb = (info: unknown) => {
      _currentState = parseStateFromCustomerInfo(info);
      try {
        cb(_currentState);
      } catch (e) {
        console.warn("[Subscriptions] listener error:", e);
      }
    };
    _nativeListeners.set(cb, nativeCb);
    try {
      _purchases.addCustomerInfoUpdateListener(nativeCb);
    } catch (e) {
      console.warn("[Subscriptions] addCustomerInfoUpdateListener failed:", e);
    }
  }

  return () => {
    _listeners.delete(cb);
    const nativeCb = _nativeListeners.get(cb);
    if (nativeCb && _purchases) {
      try {
        _purchases.removeCustomerInfoUpdateListener(nativeCb);
      } catch {
        /* ignore */
      }
      _nativeListeners.delete(cb);
    }
  };
}

/**
 * Принудительно обновить состояние (например, после покупки).
 */
export async function refreshSubscriptionState(): Promise<SubscriptionState> {
  if (!_purchases) return _currentState;

  try {
    const info = await _purchases.getCustomerInfo();
    _currentState = parseStateFromCustomerInfo(info);
    notifyListeners();
  } catch (e) {
    console.warn("[Subscriptions] refresh failed:", e);
  }
  return _currentState;
}

/**
 * Покупка продукта. productIdentifier — ID из RevenueCat dashboard.
 * Возвращает true при успехе.
 */
export async function purchaseProduct(
  productIdentifier: string,
): Promise<boolean> {
  if (!_purchases) {
    console.warn("[Subscriptions] purchase unavailable — module not loaded");
    return false;
  }

  try {
    // Используем любой доступный метод покупки в зависимости от версии SDK
    const p = _purchases as PurchasesModule & {
      purchasePackage?: (pkg: unknown) => Promise<unknown>;
      getOfferings?: () => Promise<{
        all?: Record<string, { availablePackages?: unknown[] }>;
        current?: {
          availablePackages?: Array<{
            identifier: string;
            product: { identifier: string };
          }>;
        };
      }>;
    };

    if (p.getOfferings && p.purchasePackage) {
      const offerings = await p.getOfferings();
      const pkg = offerings.current?.availablePackages?.find(
        (pk) => pk.product.identifier === productIdentifier,
      );
      if (!pkg) {
        console.warn(
          `[Subscriptions] Package ${productIdentifier} not found in offerings`,
        );
        return false;
      }
      await p.purchasePackage(pkg);
    } else {
      // Fallback для старых версий
      await _purchases.purchaseStoreProduct({
        product: { identifier: productIdentifier },
      });
    }

    await refreshSubscriptionState();
    return true;
  } catch (e) {
    const err = e as { userCancelled?: boolean; code?: string };
    if (err?.userCancelled || err?.code === "PURCHASE_CANCELLED") {
      console.log("[Subscriptions] Purchase cancelled by user");
      return false;
    }
    console.error("[Subscriptions] Purchase failed:", e);
    return false;
  }
}

/**
 * Восстановление покупок (требование Apple).
 */
export async function restorePurchases(): Promise<boolean> {
  if (!_purchases) return false;

  try {
    await _purchases.restorePurchases();
    await refreshSubscriptionState();
    return true;
  } catch (e) {
    console.error("[Subscriptions] Restore failed:", e);
    return false;
  }
}

/**
 * Готово ли окружение для платных функций (нативный модуль загружен).
 */
export function isNativeSubscriptionsAvailable(): boolean {
  return _purchases !== null;
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

/**
 * Получить offerings (доступные пакеты подписок).
 * Возвращает пустой объект, если RevenueCat недоступен (Expo Go / нет ключа).
 */
export async function getOfferings(): Promise<Offerings> {
  if (!_purchases) {
    console.log("[Subscriptions] getOfferings: unavailable (Expo Go / no key)");
    return { all: {} };
  }

  try {
    const p = _purchases as PurchasesModule & {
      getOfferings?: () => Promise<{
        current?: { availablePackages?: Array<Record<string, unknown>> };
        all?: Record<
          string,
          { availablePackages?: Array<Record<string, unknown>> }
        >;
      }>;
    };

    if (!p.getOfferings) {
      console.warn("[Subscriptions] getOfferings not supported by SDK version");
      return { all: {} };
    }

    const raw = await p.getOfferings();

    const mapPackage = (pk: Record<string, unknown>): OfferingPackage => {
      const product = (pk.product as Record<string, unknown>) ?? {};
      return {
        identifier: (pk.identifier as string) ?? "",
        productIdentifier: (product.identifier as string) ?? "",
        title: (product.title as string) ?? (pk.identifier as string) ?? "",
        description: (product.description as string) ?? "",
        priceString:
          (product.price_string as string) ??
          (product.priceString as string) ??
          "",
        price: (product.price as number) ?? 0,
        currencyCode:
          (product.currency_code as string) ??
          (product.currencyCode as string) ??
          "USD",
        packageType: (pk.packageType as string) ?? "CUSTOM",
      };
    };

    const current = raw.current?.availablePackages
      ? {
          identifier: raw.current.identifier ?? "default",
          availablePackages: raw.current.availablePackages.map(mapPackage),
        }
      : undefined;

    const all: Record<string, { availablePackages: OfferingPackage[] }> = {};
    if (raw.all) {
      for (const [key, value] of Object.entries(raw.all)) {
        all[key] = {
          availablePackages: (value.availablePackages ?? []).map(mapPackage),
        };
      }
    }

    return { current, all };
  } catch (e) {
    console.error("[Subscriptions] getOfferings failed:", e);
    return { all: {} };
  }
}
