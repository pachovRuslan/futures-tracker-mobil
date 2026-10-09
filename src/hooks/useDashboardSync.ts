import { api, isPremiumRequired } from "@/services/api";
import { EXCHANGE_CONNECTIONS_ENABLED } from "@/shared/config";
import { EXCHANGES, EXCHANGE_LABELS } from "@/shared/types";
import type { ApiExchange } from "@/shared/types";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import type { RefObject } from "react";

interface UseDashboardSyncArgs {
  /** Премиум-статус (FREE-гейт перед запуском синка). */
  isPremium: boolean;
  /** Entitlement ещё грузится? Пока грузится — гейт не решаем на клиенте. */
  subLoading: boolean;
  /** Перезагрузка данных дашборда после успешного синка. */
  loadDashboard: (isRefresh?: boolean) => Promise<void>;
  /** Guard смонтированности экрана (общий с useDashboardStats). */
  mountedRef: RefObject<boolean>;
}

/**
 * useDashboardSync — ручной синк с биржами с дашборда (кнопка «Синхрон.»
 * на hero-карточке): последовательно синкает подключённые биржи через
 * серверный мост, с прогрессом и итогом, затем перезагружает дашборд.
 *
 * Выделено из app/(tabs)/index.tsx при декомпозиции; логика перенесена
 * без изменений (syncBusy/syncMsg переехали сюда вместе с handleSync).
 */
export function useDashboardSync({
  isPremium,
  subLoading,
  loadDashboard,
  mountedRef,
}: UseDashboardSyncArgs) {
  const router = useRouter();
  /** Идёт ручной синк с биржами (кнопка «Синхрон.»). */
  const [syncBusy, setSyncBusy] = useState(false);
  /** Строка статуса синка (прогресс/итог) под hero-карточкой. */
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // ── Ручной синк с биржами (кнопка «Синхрон.») ─────────────────────────────
  //
  // ⚠️ История бага «кнопка ничего не делает»: с появления (v3.1) кнопка
  // вызывала loadDashboard(true) — ЛОКАЛЬНУЮ перезагрузку тех же данных
  // из Supabase (аналог pull-to-refresh). Новые сделки с бирж при этом
  // не подтягивались никогда: серверный синк не запускался, фидбека не
  // было — «нажал, и тишина». Настоящий синк жил только на экране
  // «Подключения». Теперь кнопка на дашборде делает то же, что «Синк
  // всё» на сайте: последовательно синкает подключённые биржи через
  // серверный мост (Bearer JWT → /api/sync/[exchange]?days=365),
  // до ~60 секунд на биржу, с прогрессом и итогом, затем перезагружает
  // дашборд — свежие сделки появляются сразу.

  const handleSync = useCallback(async () => {
    if (syncBusy) return;

    // FREE-гейт (как у кнопки «Биржа»): авто-синк — премиум-фича мобилки.
    // Пока entitlement грузится, на клиенте не решаем — сервер вернёт
    // 402 PREMIUM_REQUIRED, если подписки нет (ловим ниже).
    if (!subLoading && !isPremium) {
      router.push("/paywall");
      return;
    }

    // Kill-switch фичи подключений выключен — синкить нечем.
    if (!EXCHANGE_CONNECTIONS_ENABLED) {
      setSyncMsg("Синк с биржами временно отключён.");
      return;
    }

    setSyncBusy(true);
    const setMsg = (msg: string | null) => {
      if (mountedRef.current) setSyncMsg(msg);
    };
    setMsg("Загружаю список подключений…");

    try {
      const { connections } = await api.getConnections();
      const connected = (connections ?? [])
        .map((c) => c.exchange)
        .filter((ex) => EXCHANGES.includes(ex));

      if (connected.length === 0) {
        setMsg(
          "Нет подключённых бирж — добавьте API-ключи через кнопку «Биржа».",
        );
        return;
      }

      let upserted = 0;
      const errors: string[] = [];
      for (let i = 0; i < connected.length; i++) {
        const ex = connected[i] as ApiExchange;
        setMsg(`Синк: ${EXCHANGE_LABELS[ex]} (${i + 1}/${connected.length})…`);
        try {
          const data = await api.syncExchange(ex);
          if (data.ok) {
            upserted += data.upserted ?? 0;
          } else {
            errors.push(
              `${EXCHANGE_LABELS[ex]}: ${data.error ?? data.message ?? "сбой"}`,
            );
          }
        } catch (e) {
          // Подписка истекла, пока юзер был на дашборде — сервер отверг синк.
          if (isPremiumRequired(e)) {
            setMsg(null);
            router.push("/paywall");
            return;
          }
          errors.push(
            `${EXCHANGE_LABELS[ex]}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      setMsg(
        errors.length === 0
          ? `Готово — обновлено ${upserted} записей`
          : `Обновлено ${upserted} записей. Ошибки: ${errors.join("; ")}`,
      );

      // Свежие сделки — на дашборд сразу, без ручного pull-to-refresh.
      await loadDashboard();
    } catch (e) {
      if (isPremiumRequired(e)) {
        setMsg(null);
        router.push("/paywall");
        return;
      }
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      if (mountedRef.current) setSyncBusy(false);
    }
  }, [syncBusy, subLoading, isPremium, router, loadDashboard, mountedRef]);

  return { syncBusy, syncMsg, handleSync };
}
