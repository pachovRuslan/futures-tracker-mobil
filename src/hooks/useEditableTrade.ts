import { getSupabase } from "@/services/auth";
import type { TradeRow } from "@/shared/types";
import { useEffect, useRef, useState } from "react";

const EDIT_SELECT = [
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
 * useEditableTrade — загрузка сделки для экрана редактирования по id
 * из параметров маршрута (Supabase, RLS: строки только владельца),
 * плюс заметка для не-manual сделки (у manual — внутри TradeForm).
 */
export function useEditableTrade(id: string) {
  const [trade, setTrade] = useState<TradeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Заметка для не-manual сделки (у manual — внутри TradeForm). */
  const [notes, setNotes] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const { data, error } = await getSupabase()
          .from("trades")
          .select(EDIT_SELECT)
          .eq("id", String(id))
          .single();
        if (!mountedRef.current) return;
        if (error) throw error;
        // Без codegen-типов supabase возвращает GenericStringError[] —
        // доверяем схеме docs/supabase.sql и приводим через unknown.
        const row = (data ?? null) as unknown as TradeRow | null;
        setTrade(row);
        setNotes(row?.notes ?? "");
      } catch (e) {
        if (!mountedRef.current) return;
        setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
    return () => {
      mountedRef.current = false;
    };
  }, [id]);

  return { trade, loading, loadError, notes, setNotes };
}
