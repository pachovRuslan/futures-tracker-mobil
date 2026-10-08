import { premiumAlert } from "@/components/connections/premiumAlert";
import { api, isPremiumRequired } from "@/services/api";
import type { ApiExchange } from "@/shared/types";
import {
  EXCHANGES,
  EXCHANGE_LABELS,
  needsPassphrase,
} from "@/shared/types";
import { colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface AddConnectionFormProps {
  /** Перезагрузка списка подключений после успешного сохранения
   *  (экран передаёт свой load). */
  onSaved: () => Promise<void> | void;
}

/**
 * AddConnectionForm — форма добавления ключей биржи: выбор биржи, API Key,
 * API Secret, Passphrase (для схем с третьим ключом, сейчас Bitget).
 * Выделено из app/connections.tsx при декомпозиции; состояние формы,
 * submit и стили перенесены без изменений.
 */
export function AddConnectionForm({ onSaved }: AddConnectionFormProps) {
  const router = useRouter();
  const [exchange, setExchange] = useState<ApiExchange>(EXCHANGES[0]);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [saving, setSaving] = useState(false);

  // Bitget (схема key+secret+passphrase) требует третье поле — без него
  // бэкенд отвечает 400 «требует passphrase — укажите третье поле».
  const passRequired = needsPassphrase(exchange);

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
      await onSaved();
    } catch (e) {
      // Серверный премиум-гейт (волна 1): 402 вместо тихого обхода.
      if (isPremiumRequired(e)) {
        premiumAlert(router);
        return;
      }
      Alert.alert("Ошибка", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
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
  );
}

const styles = StyleSheet.create({
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
});
