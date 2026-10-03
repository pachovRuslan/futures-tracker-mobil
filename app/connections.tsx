import { Ionicons } from "@expo/vector-icons";
import { TrendLoader } from "@/components/TrendLoader";
import { useSubscription } from "@/hooks/useSubscription";
import { api } from "@/services/api";
import { EXCHANGE_CONNECTIONS_ENABLED } from "@/shared/config";
import type { ApiExchange, Connection } from "@/shared/types";
import { EXCHANGES, EXCHANGE_LABELS } from "@/shared/types";
import { colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ConnectionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPremium, loading: entitlementLoading } = useSubscription();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exchange, setExchange] = useState<ApiExchange>(EXCHANGES[0]);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);

  // ⚠️ Флаг функции: пока EXCHANGE_CONNECTIONS_ENABLED выключен, экран
  // закрыт даже для премиума, в т.ч. для прямого deep link (kill-switch
  // в src/shared/config.ts — для ревью сторов и сбоев бэкенда;
  // бэкенд-мост уже развёрнут, см. коммит про Bearer-JWT bridge).
  //
  // ⚠️ Гейт НА УРОВНЕ ЭКРАНА, а не только кнопки на дашборде. Раньше
  // «Подключения бирж» в настройках вёл сюда без проверки premium —
  // FREE-пользователь получал доступ к premium-функции через второй вход.
  // Экранная проверка защищает и прямой deep link.
  //
  // ⚠️ Гейт ЖДЁТ загрузки entitlement: useSubscription стартует с
  // isPremium=false, и без проверки loading'а PREMIUM-юзера отбрасывало
  // на пейволл ещё до загрузки статуса. Пейволл видел «Premium активен»
  // и автоперенаправлял обратно — получался «отскок» пейволл→дашборд
  // без единого действия со стороны пользователя.
  useEffect(() => {
    if (!EXCHANGE_CONNECTIONS_ENABLED) {
      router.replace("/");
      return;
    }
    if (entitlementLoading) return;
    if (!isPremium) {
      router.replace("/paywall");
    }
  }, [entitlementLoading, isPremium, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getConnections();
      if (mountedRef.current) setConnections(data.connections ?? []);
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
    // Не дёргаем бэкенд, пока premium не подтверждён ИЛИ функция выключена:
    // гейт может увести экран на пейволл/дашборд — останется висящий
    // запрос и ошибка на уже размонтированном экране.
    if (EXCHANGE_CONNECTIONS_ENABLED && !entitlementLoading && isPremium) {
      load();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [entitlementLoading, isPremium, load]);

  const submit = async () => {
    if (!apiKey || !apiSecret) return;
    setSaving(true);
    try {
      await api.addConnection({ exchange, apiKey, apiSecret });
      setApiKey("");
      setApiSecret("");
      await load();
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const disconnect = (ex: ApiExchange) => {
    Alert.alert("Отключить", `Отключить ${EXCHANGE_LABELS[ex]}?`, [
      { text: "Отмена" },
      {
        text: "Да",
        onPress: async () => {
          try {
            await api.deleteConnection(ex);
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
  };

  if (loading && connections.length === 0) {
    return (
      <View style={styles.center}>
        <TrendLoader />
        <Text style={styles.muted}>Загрузка подключений…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text style={styles.title}>Подключения</Text>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={load}>
            <Text style={styles.retryButtonText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      )}
      {EXCHANGES.map((ex) => {
        const conn = connections.find((c) => c.exchange === ex);
        return (
          <View key={ex} style={styles.row}>
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
              <TouchableOpacity onPress={() => disconnect(ex)}>
                <Text style={styles.disconnect}>Отключить</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      <Text style={[styles.title, { marginTop: 24 }]}>Добавить</Text>
      <View style={styles.form}>
        <View>
          <Text style={styles.fieldLabel}>Биржа</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.exchangeSelector}
          >
            {EXCHANGES.map((ex) => {
              const selected = ex === exchange;
              return (
                <TouchableOpacity
                  key={ex}
                  style={[
                    styles.exchangeChip,
                    selected && styles.exchangeChipActive,
                  ]}
                  onPress={() => setExchange(ex)}
                >
                  <Text
                    style={[
                      styles.exchangeChipText,
                      selected && styles.exchangeChipTextActive,
                    ]}
                  >
                    {EXCHANGE_LABELS[ex]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View>
          <Text style={styles.fieldLabel}>API Key</Text>
          <TextInput
            style={styles.input}
            placeholder="Введите API Key"
            placeholderTextColor={colors.textFaint}
            value={apiKey}
            onChangeText={setApiKey}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View>
          <Text style={styles.fieldLabel}>API Secret</Text>
          <TextInput
            style={styles.input}
            placeholder="Введите API Secret"
            placeholderTextColor={colors.textFaint}
            value={apiSecret}
            onChangeText={setApiSecret}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            (saving || !apiKey || !apiSecret) && styles.buttonDisabled,
          ]}
          onPress={submit}
          disabled={saving || !apiKey || !apiSecret}
        >
          <Text style={styles.buttonText}>
            {saving ? "Проверка..." : "Сохранить"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
    gap: 12,
  },
  muted: { color: colors.textMuted, fontSize: 13 },
  title: {
    fontSize: 11,
    textTransform: "uppercase",
    color: colors.textFaint,
    letterSpacing: 1,
    marginBottom: 12,
  },
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
  form: { gap: 14 },
  fieldLabel: {
    fontSize: 11,
    color: colors.textFaint,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  exchangeSelector: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  exchangeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exchangeChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  exchangeChipText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "500",
  },
  exchangeChipTextActive: {
    color: "#fff",
    fontWeight: "600",
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
  button: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  errorBox: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  errorText: { color: colors.loss, fontSize: 13 },
  retryButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  retryButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
