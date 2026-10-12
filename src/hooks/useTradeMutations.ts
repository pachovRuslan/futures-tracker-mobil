import {
  parseNum,
  tradeDatesFromForm,
  validateTradeFormValues,
  type TradeFormValues,
} from "@/components/TradeForm";
import { useI18n } from "@/i18n/I18nContext";
import { getSupabase } from "@/services/auth";
import type { TradeRow } from "@/shared/types";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

interface UseTradeMutationsArgs {
  /** Загруженная сделка (null — пока грузится или не нашли). */
  trade: TradeRow | null;
  /** Заметка для не-manual сделки (state из useEditableTrade). */
  notes: string;
}

/**
 * useTradeMutations — мутации экрана редактирования сделки: полное
 * обновление manual-сделки, сохранение заметки синканной и удаление
 * manual. Запись идёт напрямую в Supabase — RLS-политики update/delete
 * own trades (docs/supabase.sql §1) пропускают только строки владельца.
 */
export function useTradeMutations({ trade, notes }: UseTradeMutationsArgs) {
  const router = useRouter();
  const { t } = useI18n();
  /** Идёт сохранение/удаление (блокирует повторные сабмиты и кнопки). */
  const [saving, setSaving] = useState(false);

  const handleUpdate = useCallback(
    async (values: TradeFormValues) => {
      if (!trade || saving) return;

      const validationError = validateTradeFormValues(values, t);
      if (validationError) {
        Alert.alert(t("trade.checkFields"), validationError);
        return;
      }

      const { opened_at, closed_at } = tradeDatesFromForm(values);
      const update = {
        symbol: values.symbol.trim().toUpperCase(),
        side: values.side,
        qty: parseNum(values.qty),
        entry_price: parseNum(values.entryPrice),
        close_price: parseNum(values.closePrice),
        realized_pnl: parseNum(values.realizedPnl) ?? 0,
        fee: parseNum(values.fee) ?? 0,
        funding: parseNum(values.funding) ?? 0,
        opened_at,
        closed_at,
        notes: values.notes.trim() || null,
      };

      setSaving(true);
      try {
        const { error } = await getSupabase()
          .from("trades")
          .update(update)
          .eq("id", trade.id);
        if (error) {
          Alert.alert(t("common.error"), error.message);
          return;
        }
        router.back();
      } finally {
        setSaving(false);
      }
    },
    [trade, saving, router, t],
  );

  const handleSaveNotes = useCallback(async () => {
    if (!trade || saving) return;
    setSaving(true);
    try {
      const { error } = await getSupabase()
        .from("trades")
        .update({ notes: notes.trim() || null })
        .eq("id", trade.id);
      if (error) {
        Alert.alert(t("common.error"), error.message);
        return;
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }, [trade, saving, notes, router, t]);

  const handleDelete = useCallback(() => {
    if (!trade) return;
    Alert.alert(
      t("trades.deleteTitle"),
      t("trades.deleteMsg", { symbol: trade.symbol }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            const { error } = await getSupabase()
              .from("trades")
              .delete()
              .eq("id", trade.id);
            if (error) {
              Alert.alert(t("common.error"), error.message);
              return;
            }
            router.back();
          },
        },
      ],
    );
  }, [trade, router, t]);

  return { saving, handleUpdate, handleSaveNotes, handleDelete };
}
