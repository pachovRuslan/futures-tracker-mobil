import { nowUserDateTime, parseUserDateTime } from "@/shared/datetime";
import type { TradeSide } from "@/shared/types";
import { colors } from "@/theme/colors";
import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

/**
 * Общая форма сделки для экранов «Новая сделка» и «Редактирование»
 * (exchange = "manual"). Вынесена из app/trade/new.tsx, чтобы поля
 * (в т.ч. даты открытия/закрытия из волны 2) не плодились копипастой.
 *
 * Форма управляет только полями; валидация и запись — в родителе
 * (validateTradeFormValues / handleSave).
 */

/** Значения формы. Даты — пользовательский формат "YYYY-MM-DD HH:MM". */
export interface TradeFormValues {
  symbol: string;
  side: TradeSide;
  qty: string;
  entryPrice: string;
  closePrice: string;
  realizedPnl: string;
  fee: string;
  funding: string;
  openedAt: string;
  closedAt: string;
  notes: string;
}

/** Число из поля формы: запятая — тоже разделитель; "" → null. */
export function parseNum(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Валидация формы. Возвращает текст ошибки или null, если всё ок.
 * Проверяет тикер, все числовые поля (раньше молча терялся qty с
 * опечаткой) и обе даты, включая логику «закрытие раньше открытия».
 */
export function validateTradeFormValues(v: TradeFormValues): string | null {
  if (!v.symbol.trim()) return "Укажите тикер (например, BTCUSDT).";

  const numericFields: Array<[keyof TradeFormValues, string]> = [
    ["realizedPnl", "P&L"],
    ["qty", "Количество"],
    ["entryPrice", "Entry"],
    ["closePrice", "Close"],
    ["fee", "Комиссия"],
    ["funding", "Funding"],
  ];
  for (const [field, label] of numericFields) {
    const raw = v[field] as string;
    if (raw.trim() && parseNum(raw) == null) {
      return `${label} должен быть числом.`;
    }
  }

  const openedIso = v.openedAt.trim() ? parseUserDateTime(v.openedAt) : null;
  if (v.openedAt.trim() && !openedIso) {
    return "Дата открытия: формат ГГГГ-ММ-ДД ЧЧ:ММ (например, 2026-10-05 14:30).";
  }
  const closedIso = v.closedAt.trim() ? parseUserDateTime(v.closedAt) : null;
  if (v.closedAt.trim() && !closedIso) {
    return "Дата закрытия: формат ГГГГ-ММ-ДД ЧЧ:ММ (например, 2026-10-05 14:30).";
  }
  if (openedIso && closedIso && new Date(closedIso) < new Date(openedIso)) {
    return "Дата закрытия раньше даты открытия.";
  }

  return null;
}

/**
 * Даты формы → колонки БД.
 *   - opened_at: пустое поле → текущий момент (как до волны 2);
 *   - closed_at: пустое → null для открытой позиции (нет Close-цены),
 *     либо текущий момент, если Close-цена указана (как до волны 2).
 */
export function tradeDatesFromForm(
  v: TradeFormValues,
): { opened_at: string | null; closed_at: string | null } {
  const openedIso = v.openedAt.trim() ? parseUserDateTime(v.openedAt) : null;
  const closedIso = v.closedAt.trim() ? parseUserDateTime(v.closedAt) : null;
  return {
    opened_at: openedIso ?? new Date().toISOString(),
    closed_at: closedIso ?? (!v.closePrice.trim() ? null : new Date().toISOString()),
  };
}

interface TradeFormProps {
  /** Начальные значения (редактирование); undefined — новая сделка. */
  initial?: TradeFormValues;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: TradeFormValues) => void;
  /** Дизейбл кнопки (родитель решает по своей валидации). */
  submitDisabled?: boolean;
}

/** Поле даты-времени: ввод + кнопка «сейчас». */
function DateTimeField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dtRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          value={value}
          onChangeText={onChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={styles.nowButton}
          onPress={() => onChange(nowUserDateTime())}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={styles.nowButtonText}>сейчас</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function TradeForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
  submitDisabled,
}: TradeFormProps) {
  const [symbol, setSymbol] = useState(initial?.symbol ?? "");
  const [side, setSide] = useState<TradeSide>(initial?.side ?? "long");
  const [qty, setQty] = useState(initial?.qty ?? "");
  const [entryPrice, setEntryPrice] = useState(initial?.entryPrice ?? "");
  const [closePrice, setClosePrice] = useState(initial?.closePrice ?? "");
  const [realizedPnl, setRealizedPnl] = useState(initial?.realizedPnl ?? "");
  const [fee, setFee] = useState(initial?.fee ?? "");
  const [funding, setFunding] = useState(initial?.funding ?? "");
  const [openedAt, setOpenedAt] = useState(initial?.openedAt ?? "");
  const [closedAt, setClosedAt] = useState(initial?.closedAt ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const submit = () => {
    onSubmit({
      symbol,
      side,
      qty,
      entryPrice,
      closePrice,
      realizedPnl,
      fee,
      funding,
      openedAt,
      closedAt,
      notes,
    });
  };

  const disabled = submitting || submitDisabled || !symbol.trim();

  return (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>Тикер *</Text>
        <TextInput
          style={styles.input}
          placeholder="BTCUSDT"
          placeholderTextColor={colors.textFaint}
          value={symbol}
          onChangeText={setSymbol}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Направление</Text>
        <View style={styles.sideRow}>
          {(["long", "short"] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.sideButton,
                side === s && styles.sideButtonActive,
                side === s && s === "long" && { backgroundColor: colors.profit },
                side === s && s === "short" && { backgroundColor: colors.loss },
              ]}
              onPress={() => setSide(s)}
            >
              <Text style={[styles.sideText, side === s && styles.sideTextActive]}>
                {s === "long" ? "LONG" : "SHORT"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.fieldRow}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Кол-во</Text>
          <TextInput
            style={styles.input}
            placeholder="0.01"
            placeholderTextColor={colors.textFaint}
            value={qty}
            onChangeText={setQty}
            keyboardType="numeric"
          />
        </View>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>P&L, USDT *</Text>
          <TextInput
            style={styles.input}
            placeholder="-12.5"
            placeholderTextColor={colors.textFaint}
            value={realizedPnl}
            onChangeText={setRealizedPnl}
            keyboardType="numeric"
          />
        </View>
      </View>

      <View style={styles.fieldRow}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Entry</Text>
          <TextInput
            style={styles.input}
            placeholder="42000"
            placeholderTextColor={colors.textFaint}
            value={entryPrice}
            onChangeText={setEntryPrice}
            keyboardType="numeric"
          />
        </View>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Close</Text>
          <TextInput
            style={styles.input}
            placeholder="пусто = открыта"
            placeholderTextColor={colors.textFaint}
            value={closePrice}
            onChangeText={setClosePrice}
            keyboardType="numeric"
          />
        </View>
      </View>

      <View style={styles.fieldRow}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Комиссия</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor={colors.textFaint}
            value={fee}
            onChangeText={setFee}
            keyboardType="numeric"
          />
        </View>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Funding</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor={colors.textFaint}
            value={funding}
            onChangeText={setFunding}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* Даты (волна 2): раньше всегда писалось «сейчас» — задним
          числом сделку завести было нельзя. */}
      <DateTimeField
        label="Открыта"
        value={openedAt}
        onChange={setOpenedAt}
        placeholder="ГГГГ-ММ-ДД ЧЧ:ММ"
      />
      <DateTimeField
        label="Закрыта"
        value={closedAt}
        onChange={setClosedAt}
        placeholder="пусто = как открыта/сейчас"
      />

      <View style={styles.field}>
        <Text style={styles.label}>Заметки</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Опционально"
          placeholderTextColor={colors.textFaint}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </View>

      <TouchableOpacity
        style={[styles.button, disabled && styles.buttonDisabled]}
        onPress={submit}
        disabled={disabled}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{submitLabel}</Text>
        )}
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  fieldRow: { flexDirection: "row", gap: 12 },
  label: {
    fontSize: 11,
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 14,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notesInput: { minHeight: 80, textAlignVertical: "top" },
  dtRow: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  nowButton: {
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  nowButtonText: { fontSize: 11, color: colors.accent, fontWeight: "600" },
  sideRow: { flexDirection: "row", gap: 8 },
  sideButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sideButtonActive: { borderColor: "transparent" },
  sideText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  sideTextActive: { color: "#fff" },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
