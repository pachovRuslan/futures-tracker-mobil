import { getSupabase } from "@/services/auth";
import { TRADES_PAGE_SIZE } from "@/shared/config";
import type { TradeRow } from "@/shared/types";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseTradesResult {
  trades: TradeRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const TRADES_SELECT = [
  "id",
  "exchange",
  "symbol",
  "side",
  "qty",
  "entry_price",
  "close_price",
  "realized_pnl",
  "fee",
  "funding",
  "opened_at",
  "closed_at",
  "notes",
].join(", ");

/**
 * useTrades — загрузка списка сделок напрямую из Supabase (через RLS).
 *
 * ⚠️ История бага: раньше хук ходил на REST-бэкенд
 * (EXPO_PUBLIC_API_URL/api/trades), которого НЕ СУЩЕСТВУЕТ — бэкенд
 * отвечал 307 → /login HTML-страницей, и вкладка «Сделки» вечно падала с
 * "Unexpected token <". Дашборд при этом читал Supabase напрямую — отсюда
 * и расхождение «дашборд работает, список сделок — нет». Теперь весь
 * read-path идёт напрямую в Supabase единообразно.
 *
 * Защита от race conditions: обновляет state только последний по счёту
 * запрос (requestIdRef). AbortController не используется — клиент
 * supabase-js не принимает fetch-signal, комментарий в старой версии
 * «AbortController отменяет fetch при unmount» не соответствовал
 * действительности.
 */
export function useTrades(): UseTradesResult {
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);

    try {
      const { data, error: dbError } = await getSupabase()
        .from("trades")
        .select(TRADES_SELECT)
        .order("closed_at", { ascending: false, nullsFirst: false })
        .limit(TRADES_PAGE_SIZE);

      if (mountedRef.current && requestId === requestIdRef.current) {
        if (dbError) throw new Error(dbError.message);
        // Без codegen-типов supabase возвращает GenericStringError[] —
        // доверяем схеме docs/supabase.sql и приводим через unknown.
        setTrades((data ?? []) as unknown as TradeRow[]);
      }
    } catch (e) {
      if (mountedRef.current && requestId === requestIdRef.current) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        if (__DEV__) console.error("[useTrades] load error:", msg);
      }
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  return { trades, loading, error, reload: load };
}
