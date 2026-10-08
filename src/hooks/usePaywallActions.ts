import {
  purchasePremium,
  restorePremium,
  syncEntitlementToServer,
} from "@/services/purchases";
import { useCallback, useState } from "react";
import type { PurchasesPackage } from "react-native-purchases";

/** Какая покупочная операция идёт сейчас (для спиннеров и disabled). */
export type PaywallBusy = "buy" | "restore" | null;

/**
 * Покупочные действия пейволла: покупка, restore, сверка entitlement
 * с сервером. Выделено из app/paywall.tsx при декомпозиции; логика
 * (включая busy/error-состояние) перенесена без изменений.
 */
export function usePaywallActions(
  /** Выбранный тариф (кнопка «Подписаться» активна только с ним). */
  selected: PurchasesPackage | null,
  /** refresh из useSubscription — force=true обходит кэш после покупки. */
  refresh: (force?: boolean) => Promise<void>,
) {
  const [busy, setBusy] = useState<PaywallBusy>(null);
  const [error, setError] = useState<string | null>(null);

  /** Покупка/restore → сверка с сервером → принудительный refresh статуса. */
  const finalize = useCallback(async () => {
    try {
      await syncEntitlementToServer();
    } catch (e) {
      if (__DEV__) console.warn("[paywall] sync entitlement error:", e);
      // Покупка могла пройти, а сверка — нет (сеть). Всё равно
      // перечитаем entitlement: сервер мог увидеть её другим путём.
    }
    await refresh(true);
    // Редирект сделает effect экрана, когда isPremium станет true.
  }, [refresh]);

  const handleBuy = useCallback(async () => {
    if (!selected || busy) return;
    setBusy("buy");
    setError(null);
    try {
      await purchasePremium(selected);
      await finalize();
    } catch (e) {
      const cancelled =
        typeof e === "object" && e !== null && "userCancelled" in e
          ? Boolean((e as { userCancelled: boolean | null }).userCancelled)
          : false;
      if (!cancelled) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      }
    } finally {
      setBusy(null);
    }
  }, [selected, busy, finalize]);

  const handleRestore = useCallback(async () => {
    if (busy) return;
    setBusy("restore");
    setError(null);
    try {
      await restorePremium();
      await finalize();
      // Если после restore премиума нет — честно скажем, а не промолчим.
      setError("Покупки восстановлены. Если Premium не активировался — проверьте аккаунт стора.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setBusy(null);
    }
  }, [busy, finalize]);

  return { busy, error, handleBuy, handleRestore };
}
