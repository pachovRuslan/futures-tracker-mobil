import { useI18n } from "@/i18n/I18nContext";
import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — ловит ошибки рендеринга и предотвращает белый экран.
 *
 * Expo Router также поддерживает app/_error.tsx, но ErrorBoundary как
 * React-компонент даёт больше контроля над UI.
 */

/**
 * UI ошибки — отдельная функция-компонент (класс хуков не умеет).
 * Провайдеры темы и языка к этому моменту размонтированы — useTheme
 * деградирует до системной темы, useI18n — к последнему языку
 * (см. ThemeContext и I18nContext).
 */
function ErrorFallback({
  error,
  onReset,
}: {
  error: Error | null;
  onReset: () => void;
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  // Провайдер языка к этому моменту размонтирован — useI18n
  // деградирует к последнему выбранному языку (модульное состояние).
  const { t } = useI18n();
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.emoji}>⚠️</Text>
        <Text style={styles.title}>{t("errorScreen.title")}</Text>
        <Text style={styles.subtitle}>{t("errorScreen.subtitle")}</Text>
        {__DEV__ && error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error.message}</Text>
            {error.stack ? (
              <Text style={styles.stack}>{error.stack.slice(0, 1000)}</Text>
            ) : null}
          </View>
        ) : null}
        <Pressable style={styles.button} onPress={onReset}>
          <Text style={styles.buttonText}>{t("errorScreen.retry")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (__DEV__) {
      console.error("[ErrorBoundary]", error, errorInfo.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <ErrorFallback error={this.state.error} onReset={this.handleReset} />
    );
  }
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 12,
  },
  emoji: { fontSize: 48 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    width: "100%",
  },
  errorText: { color: colors.loss, fontSize: 13, fontWeight: "600" },
  stack: {
    color: colors.textFaint,
    fontSize: 10,
    marginTop: 8,
    fontFamily: "monospace",
  },
  button: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
