import type { BalanceSnapshot } from "@/shared/types";
import { colors } from "@/theme/colors";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface BalanceRowProps {
  snapshot: BalanceSnapshot;
  /** Долгое нажатие на карточку — запрос подтверждения удаления. */
  onDelete: (s: BalanceSnapshot) => void;
}

/**
 * BalanceRow — карточка снапшота баланса: сумма, дата, опциональная
 * заметка. Долгое нажатие (400 мс) — удаление.
 *
 * Выделено из app/(tabs)/balance.tsx при декомпозиции; разметка,
 * задержка long-press и стили перенесены без изменений.
 */
export function BalanceRow({ snapshot: s, onDelete }: BalanceRowProps) {
  return (
    <TouchableOpacity
      style={styles.row}
      onLongPress={() => onDelete(s)}
      delayLongPress={400}
    >
      <View>
        <Text style={styles.value}>${Number(s.value_usd).toFixed(2)}</Text>
        <Text style={styles.date}>{s.snapshot_date}</Text>
      </View>
      {s.note ? <Text style={styles.note}>{s.note}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 8,
  },
  value: { fontSize: 16, fontWeight: "600", color: colors.text },
  date: { fontSize: 11, color: colors.textFaint, marginTop: 4 },
  note: { fontSize: 11, color: colors.textMuted, maxWidth: 120 },
});
