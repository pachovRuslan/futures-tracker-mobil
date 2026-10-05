import { Ionicons } from "@expo/vector-icons";
import { TrendLoader } from "@/components/TrendLoader";
import { useSubscription } from "@/hooks/useSubscription";
import { api, isPremiumRequired } from "@/services/api";
import { EXCHANGE_CONNECTIONS_ENABLED } from "@/shared/config";
import type { ApiExchange, Connection } from "@/shared/types";
import {
  EXCHANGES,
  EXCHANGE_LABELS,
  needsPassphrase,
} from "@/shared/types";
import { colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
  const [passphrase, setPassphrase] = useState("");
  const [saving, setSaving] = useState(false);
  /** Идентификатор активного синка: биржа или "all"; null — не идёт. */
  const [syncing, setSyncing] = useState<string | null>(null);
  /** Строка статуса синка (прогресс/итог) под кнопкой «Синк все». */
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Bitget (схема key+secret+passphrase) требует третье поле — без него
  // бэкенд отвечает 400 «требует passphrase — укажите третье поле».
  const passRequired = needsPassphrase(exchange);

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
      // Серверный премиум-гейт: подписка истекла, пока юзер был на экране.
      if (isPremiumRequired(e)) {
        router.replace("/paywall");
        return;
      }
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [router]);

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
    if (!apiKey || !apiSecret || (passRequired && !passphrase)) return;
    setSaving(true);
    try {
      await api.addConnection({
        exchange,
        apiKey,
        apiSecret,
        ...(passRequired ? { passphrase } : {}),
      });
      setApiKey("");
      setApiSecret("");
      setPassphrase("");
      await load();
    } catch (e) {
      // Серверный премиум-гейт (волна 1): 402 вместо тихого обхода.
      if (isPremiumRequired(e)) {
        Alert.alert(
          "Требуется Premium",
          "Подключения бирж и авто-синк доступны по подписке Premium.",
          [
            { text: "Позже", style: "cancel" },
            {
              text: "Перейти на Premium",
              onPress: () => router.push("/paywall"),
            },
          ],
        );
        return;
      }
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

  // ── Ручной запуск синка (волна 2) ─────────────────────────────────────────
  // Раньше мобилка вообще не умела запускать синк: только суточный cron
  // сайта (00:00 UTC) или кнопка на сайте. Здесь — как на вебе: синк
  // идёт от имени сервера с сохранёнными ключами, до 60 секунд на биржу.

  const premiumAlert = () => {
    Alert.alert(
      "Требуется Premium",
      "Подключения бирж и авто-синк доступны по подписке Premium.",
      [
        { text: "Позже", style: "cancel" },
        {
          text: "Перейти на Premium",
          onPress: () => router.push("/paywall"),
        },
      ],
    );
  };

  const syncOne = async (ex: ApiExchange): Promise<void> => {
    if (syncing) return;
    setSyncing(ex);
    setSyncMsg(`Синк ${EXCHANGE_LABELS[ex]}…`);
    try {
      const data = await api.syncExchange(ex);
      if (!mountedRef.current) return;
      if (data.ok) {
        setSyncMsg(
          `${EXCHANGE_LABELS[ex]}: обновлено ${data.upserted ?? 0} записей`,
        );
      } else {
        setSyncMsg(
          `${EXCHANGE_LABELS[ex]}: ${data.error ?? data.message ?? "не удалось"}`,
        );
      }
    } catch (e) {
      if (!mountedRef.current) return;
      if (isPremiumRequired(e)) {
        setSyncMsg(null);
        premiumAlert();
        return;
      }
      setSyncMsg(e instanceof Error ? e.message : String(e));
    } finally {
      if (mountedRef.current) setSyncing(null);
    }
  };

  const syncAll = async (): Promise<void> => {
    if (syncing) return;
    const connected = connections
      .map((c) => c.exchange)
      .filter((ex) => EXCHANGES.includes(ex));
    if (connected.length === 0) {
      setSyncMsg("Нет подключённых бирж — добавьте ключ ниже.");
      return;
    }

    setSyncing("all");
    let upserted = 0;
    const errors: string[] = [];
    try {
      for (let i = 0; i < connected.length; i++) {
        const ex = connected[i];
        setSyncMsg(
          `Синк: ${EXCHANGE_LABELS[ex]} (${i + 1}/${connected.length})…`,
        );
        try {
          const data = await api.syncExchange(ex);
          if (data.ok) {
            upserted += data.upserted ?? 0;
          } else {
            errors.push(`${EXCHANGE_LABELS[ex]}: ${data.error ?? "сбой"}`);
          }
        } catch (e) {
          // Гейт сработал посреди последовательности — обрываем всё.
          if (isPremiumRequired(e)) {
            if (mountedRef.current) setSyncMsg(null);
            premiumAlert();
            return;
          }
          errors.push(
            `${EXCHANGE_LABELS[ex]}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      if (!mountedRef.current) return;
      if (errors.length === 0) {
        setSyncMsg(`Готово — обновлено ${upserted} записей`);
      } else {
        setSyncMsg(
          `Обновлено ${upserted} записей. Ошибки: ${errors.join("; ")}`,
        );
      }
    } finally {
      if (mountedRef.current) setSyncing(null);
    }
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

      {/* Ручной синк: кнопка «все» + статусная строка. Свежие сделки
          появятся на дашборде при возврате (он перезагружается по фокусу). */}
      {connections.length > 0 && (
        <View style={styles.syncBox}>
          <TouchableOpacity
            style={[
              styles.syncButton,
              syncing && styles.syncButtonDisabled,
            ]}
            onPress={syncAll}
            disabled={syncing != null}
          >
            {syncing === "all" ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <>
                <Ionicons name="sync" size={14} color={colors.accent} />
                <Text style={styles.syncButtonText}>Синк все биржи</Text>
              </>
            )}
          </TouchableOpacity>
          {syncMsg && <Text style={styles.syncMsg}>{syncMsg}</Text>}
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
              <View style={styles.rowActions}>
                <TouchableOpacity
                  style={styles.syncIconButton}
                  onPress={() => syncOne(ex)}
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
                <TouchableOpacity onPress={() => disconnect(ex)}>
                  <Text style={styles.disconnect}>Отключить</Text>
                </TouchableOpacity>
              </View>
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
                  onPress={() => {
                    setExchange(ex);
                    // Прошлый passphrase не должен «залипнуть» при
                    // переключении на биржу без третьего ключа.
                    setPassphrase("");
                  }}
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

        {passRequired && (
          <View>
            <Text style={styles.fieldLabel}>Passphrase</Text>
            <TextInput
              style={styles.input}
              placeholder="Третий ключ из API-настроек Bitget"
              placeholderTextColor={colors.textFaint}
              value={passphrase}
              onChangeText={setPassphrase}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.fieldHint}>
              {EXCHANGE_LABELS[exchange]} выдаёт три ключа при создании
              API-ключа: Key, Secret и Passphrase.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.button,
            (saving ||
              !apiKey ||
              !apiSecret ||
              (passRequired && !passphrase)) &&
              styles.buttonDisabled,
          ]}
          onPress={submit}
          disabled={
            saving || !apiKey || !apiSecret || (passRequired && !passphrase)
          }
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
  syncBox: { marginBottom: 12, gap: 8 },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  syncButtonDisabled: { opacity: 0.5 },
  syncButtonText: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  syncMsg: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  rowActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  syncIconButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
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
  fieldHint: {
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 6,
    lineHeight: 15,
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
