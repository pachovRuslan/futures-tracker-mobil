import { getSupabase } from "@/services/auth";
import type { BalanceSnapshot } from "@/shared/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

const BALANCE_SELECT = "id,type,value_usd,snapshot_date,note,created_at";

/**
 * useBalanceSnapshots — чтение и удаление снапшотов баланса
 * (Supabase, RLS: строки только владельца).
 *
 * Выделено из app/(tabs)/balance.tsx при декомпозиции; запрос,
 * mountedRef и confirmDelete перенесены без изменений.
 */
export function useBalanceSnapshots() {
  const [snapshots, setSnapshots] = useState<BalanceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await getSupabase()
        .from("balance_snapshots")
        .select(BALANCE_SELECT)
        .order("snapshot_date", { ascending: false });
      if (dbError) throw new Error(dbError.message);
      if (mountedRef.current) setSnapshots((data ?? []) as BalanceSnapshot[]);
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  const confirmDelete = useCallback(
    (s: BalanceSnapshot) => {
      Alert.alert("Удалить запись", `$${s.value_usd} от ${s.snapshot_date}?`, [
        { text: "Отмена" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            try {
              const { error: delError } = await getSupabase()
                .from("balance_snapshots")
                .delete()
                .eq("id", s.id);
              if (delError) throw delError;
              await load();
            } catch (e) {
              Alert.alert(
                "Ошибка",
                e instanceof Error ? e.message : String(e),
              );
            }
          },
        },
      ]);
    },
    [load],
  );

  return { snapshots, loading, error, load, confirmDelete };
}
