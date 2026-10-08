import { TrendLoader } from "@/components/TrendLoader";
import { AddConnectionForm } from "@/components/connections/AddConnectionForm";
import { ExchangeRow } from "@/components/connections/ExchangeRow";
import { SyncAllBox } from "@/components/connections/SyncAllBox";
import { useConnectionsSync } from "@/hooks/useConnectionsSync";
import { useSubscription } from "@/hooks/useSubscription";
import { api, isPremiumRequired } from "@/services/api";
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

  const { syncing, syncMsg, syncOne, syncAll } =
    useConnectionsSync(connections);

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
        <SyncAllBox syncing={syncing} syncMsg={syncMsg} onSyncAll={syncAll} />
      )}

      {EXCHANGES.map((ex) => {
        const conn = connections.find((c) => c.exchange === ex);
        return (
          <ExchangeRow
            key={ex}
            ex={ex}
            conn={conn}
            syncing={syncing}
            onSync={syncOne}
            onDisconnect={disconnect}
          />
        );
      })}

      <Text style={[styles.title, { marginTop: 24 }]}>Добавить</Text>
      <AddConnectionForm onSaved={load} />
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
