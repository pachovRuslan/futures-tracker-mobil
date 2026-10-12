import { TradeForm, parseNum, tradeDatesFromForm, validateTradeFormValues, type TradeFormValues } from "@/components/TradeForm";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { getSupabase } from "@/services/auth";
import { FREE_TRADE_LIMIT } from "@/shared/config";
import { nowUserDateTime } from "@/shared/datetime";
import type { TradeInsert } from "@/shared/types";
import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

/**
 * Ручное добавление сделки (exchange = "manual").
 *
 * Вставка идёт напрямую в Supabase — RLS-политика users_insert_own_trades
 * гарантирует, что юзер может писать только свои строки (user_id =
 * auth.uid()); серверный лимит FREE дублирует BEFORE INSERT-триггер
 * enforce_free_trade_limit (docs/supabase.sql §6).
 *
 * Форма вынесена в TradeForm (общая с экраном редактирования). Даты
 * открытия/закрытия — отдельные поля с кнопкой «сейчас».
 */
export default function NewTradeScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (values: TradeFormValues) => {
    if (saving || !user?.id) return;

    const validationError = validateTradeFormValues(values, t);
    if (validationError) {
      Alert.alert(t("trade.checkFields"), validationError);
      return;
    }

    const sym = values.symbol.trim().toUpperCase();
    const { opened_at, closed_at } = tradeDatesFromForm(values);

    const payload: TradeInsert = {
      user_id: user.id,
      exchange: "manual",
      external_id: `manual-${Date.now()}`,
      symbol: sym,
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
      const { error } = await getSupabase().from("trades").insert(payload);
      if (error) {
        // Серверный лимит FREE (триггер enforce_free_trade_limit, docs/supabase.sql §6):
        // клиентская проверка — лишь UX, бэкенд — источник правды.
        if (error.message.includes("FREE_TRADE_LIMIT_REACHED")) {
          Alert.alert(
            t("trade.freeLimitTitle"),
            t("trade.freeLimitMsg", { limit: FREE_TRADE_LIMIT }),
            [
              { text: t("common.later"), style: "cancel" },
              {
                text: t("common.upgrade"),
                onPress: () => router.push("/paywall"),
              },
            ],
          );
          return;
        }
        Alert.alert(t("common.error"), error.message);
        return;
      }

      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen
        options={{ title: t("trade.newTitle"), headerShown: true }}
      />
      <View style={{ gap: 12 }}>
        <TradeForm
          initial={{
            symbol: "",
            side: "long",
            qty: "",
            entryPrice: "",
            closePrice: "",
            realizedPnl: "",
            fee: "",
            funding: "",
            // Дата открытия по умолчанию — «сейчас», но видна и редактируема:
            // честнее, чем молча писать now() в БД.
            openedAt: nowUserDateTime(),
            closedAt: "",
            notes: "",
          }}
          submitLabel={t("trade.save")}
          submitting={saving}
          onSubmit={handleSubmit}
        />
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32, gap: 4 },
});
