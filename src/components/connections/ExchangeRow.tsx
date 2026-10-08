import { Ionicons } from "@expo/vector-icons";
import type { ApiExchange, Connection } from "@/shared/types";
import { EXCHANGE_LABELS } from "@/shared/types";
import { colors } from "@/theme/colors";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface ExchangeRowProps {
  /** Биржа строки (перечисляются все EXCHANGES, не только подключённые). */
  ex: ApiExchange;
  /** Подключение этой биржи; undefined — не подключено. */
  conn?: Connection;
  /** Идентификатор активного синка: биржа или "all"; null — не идёт. */
  syncing: string | null;
  /** Ручной синк одной биржи. */
  onSync: (ex: ApiExchange) => void;
  /** Отключение биржи (подтверждение — логика экрана). */
  onDisconnect: (ex: ApiExchange) => void;
}

/**
 * ExchangeRow — строка списка бирж: название, preview ключа или «не
 * подключено», кнопки ручного синка и отключения. Выделено из
 * app/connections.tsx при декомпозиции; разметка и стили перенесены без
 * изменений.
 */
export function ExchangeRow({
  ex,
  conn,
  syncing,
  onSync,
  onDisconnect,
}: ExchangeRowProps) {
  return (
    <View style={styles.row}>
      <View>
        <Text style={styles.exchangeName}>{EXCHANGE_LABELS[ex]}</Text>
        {conn ? (
          <View style={styles.connectedRow}>
            <Ionicons name="checkmark" size={12} color={colors.profit} />
            <Text style={styles.connected}>{conn.key_preview}</Text>
          </View>
        ) : (
          <Text style={styles.notConnected}>не подключено</Text>
        )}
      </View>
      {conn && (
        <View style={styles.rowActions}>
          <TouchableOpacity
            style={styles.syncIconButton}
            onPress={() => onSync(ex)}
            disabled={syncing != null}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {syncing === ex ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons
                name="sync"
                size={16}
                color={syncing ? colors.textFaint : colors.textMuted}
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDisconnect(ex)}>
            <Text style={styles.disconnect}>Отключить</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  exchangeName: { fontSize: 14, color: colors.text, fontWeight: "500" },
  connectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  connected: { fontSize: 11, color: colors.profit },
  notConnected: { fontSize: 11, color: colors.textFaint, marginTop: 4 },
  disconnect: { fontSize: 12, color: colors.loss },
  rowActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  syncIconButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
