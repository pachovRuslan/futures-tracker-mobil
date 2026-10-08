import { premiumAlert } from "@/components/connections/premiumAlert";
import { api, isPremiumRequired } from "@/services/api";
import type { ApiExchange, Connection } from "@/shared/types";
import { EXCHANGES, EXCHANGE_LABELS } from "@/shared/types";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

/**
 * Ручной запуск синка (волна 2). Раньше мобилка вообще не умела запускать
 * синк: только суточный cron сайта (00:00 UTC) или кнопка на сайте. Здесь —
 * как на вебе: синк идёт от имени сервера с сохранёнными ключами, до 60
 * секунд на биржу.
 *
 * Выделено из app/connections.tsx при декомпозиции; логика перенесена без
 * изменений (mountedRef и его эффект повторяют экранные один-в-один).
 */
export function useConnectionsSync(connections: Connection[]) {
  const router = useRouter();
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
    setSyncMsg(`Синк ${EXCHANGE_LABELS[ex]}…`);
    try {
      const data = await api.syncExchange(ex);
      if (!mountedRef.current) return;
      if (data.ok) {
        setSyncMsg(
          `${EXCHANGE_LABELS[ex]}: обновлено ${data.upserted ?? 0} записей`,
        );
      } else {
        setSyncMsg(
          `${EXCHANGE_LABELS[ex]}: ${data.error ?? data.message ?? "не удалось"}`,
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
      setSyncMsg("Нет подключённых бирж — добавьте ключ ниже.");
      return;
    }

    setSyncing("all");
    let upserted = 0;
    const errors: string[] = [];
    try {
      for (let i = 0; i < connected.length; i++) {
        const ex = connected[i];
        setSyncMsg(
          `Синк: ${EXCHANGE_LABELS[ex]} (${i + 1}/${connected.length})…`,
        );
        try {
          const data = await api.syncExchange(ex);
          if (data.ok) {
            upserted += data.upserted ?? 0;
          } else {
            errors.push(`${EXCHANGE_LABELS[ex]}: ${data.error ?? "сбой"}`);
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
        setSyncMsg(`Готово — обновлено ${upserted} записей`);
      } else {
        setSyncMsg(
          `Обновлено ${upserted} записей. Ошибки: ${errors.join("; ")}`,
        );
      }
    } finally {
      if (mountedRef.current) setSyncing(null);
    }
  };

  return { syncing, syncMsg, syncOne, syncAll };
}
