import { premiumAlert } from "@/components/connections/premiumAlert";
import { useI18n } from "@/i18n/I18nContext";
import { api, isPremiumRequired } from "@/services/api";
import type { ApiExchange, Connection } from "@/shared/types";
import { EXCHANGES, EXCHANGE_LABELS } from "@/shared/types";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

/**
 * Ручной запуск синка сделок с бирж с мобильного. Синк идёт от имени
 * сервера с сохранёнными ключами, до 60 секунд на биржу.
 */
export function useConnectionsSync(connections: Connection[]) {
  const router = useRouter();
  const { t } = useI18n();
  /** Идентификатор активного синка: биржа или "all"; null — не идёт. */
  const [syncing, setSyncing] = useState<string | null>(null);
  /** Строка статуса синка (прогресс/итог) под кнопкой «Синк все». */
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const syncOne = async (ex: ApiExchange): Promise<void> => {
    if (syncing) return;
    setSyncing(ex);
    setSyncMsg(t("sync.syncingOne", { exchange: EXCHANGE_LABELS[ex] }));
    try {
      const data = await api.syncExchange(ex);
      if (!mountedRef.current) return;
      if (data.ok) {
        setSyncMsg(
          t("sync.doneOne", {
            exchange: EXCHANGE_LABELS[ex],
            count: data.upserted ?? 0,
          }),
        );
      } else {
        setSyncMsg(
          `${EXCHANGE_LABELS[ex]}: ${
            data.error ?? data.message ?? t("sync.failShort2")
          }`,
        );
      }
    } catch (e) {
      if (!mountedRef.current) return;
      if (isPremiumRequired(e)) {
        setSyncMsg(null);
        premiumAlert(router);
        return;
      }
      setSyncMsg(e instanceof Error ? e.message : String(e));
    } finally {
      if (mountedRef.current) setSyncing(null);
    }
  };

  const syncAll = async (): Promise<void> => {
    if (syncing) return;
    const connected = connections
      .map((c) => c.exchange)
      .filter((ex) => EXCHANGES.includes(ex));
    if (connected.length === 0) {
      setSyncMsg(t("sync.noConnectionsConn"));
      return;
    }

    setSyncing("all");
    let upserted = 0;
    const errors: string[] = [];
    try {
      for (let i = 0; i < connected.length; i++) {
        const ex = connected[i];
        setSyncMsg(
          t("sync.progress", {
            exchange: EXCHANGE_LABELS[ex],
            i: i + 1,
            n: connected.length,
          }),
        );
        try {
          const data = await api.syncExchange(ex);
          if (data.ok) {
            upserted += data.upserted ?? 0;
          } else {
            errors.push(
              `${EXCHANGE_LABELS[ex]}: ${data.error ?? t("sync.failShort")}`,
            );
          }
        } catch (e) {
          // Гейт сработал посреди последовательности — обрываем всё.
          if (isPremiumRequired(e)) {
            if (mountedRef.current) setSyncMsg(null);
            premiumAlert(router);
            return;
          }
          errors.push(
            `${EXCHANGE_LABELS[ex]}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      if (!mountedRef.current) return;
      if (errors.length === 0) {
        setSyncMsg(t("sync.done", { count: upserted }));
      } else {
        setSyncMsg(
          t("sync.doneWithErrors", {
            count: upserted,
            errors: errors.join("; "),
          }),
        );
      }
    } finally {
      if (mountedRef.current) setSyncing(null);
    }
  };

  return { syncing, syncMsg, syncOne, syncAll };
}
