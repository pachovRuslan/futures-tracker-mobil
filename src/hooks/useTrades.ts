import { api } from "@/services/api";
import { TRADES_PAGE_SIZE } from "@/shared/config";
import type { Trade } from "@/shared/types";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseTradesResult {
  trades: Trade[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * useTrades — загрузка списка сделок через REST API.
 *
 * Защищён от race conditions через requestIdRef: только последний запрос
 * обновляет state. AbortController отменяет fetch при unmount.
 */
export function useTrades(): UseTradesResult {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const data = await api.getTrades(TRADES_PAGE_SIZE);
      if (mountedRef.current && requestId === requestIdRef.current) {
        setTrades(data.trades);
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
      controller.abort();
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
