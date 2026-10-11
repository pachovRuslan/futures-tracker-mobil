import { darkColors, lightColors, type ThemeColors } from "./colors";
import { StatusBar } from "expo-status-bar";
import {
  Appearance,
  Platform,
  useColorScheme,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Тема приложения: system / light / dark.
 *
 * Паттерн повторяет AuthContext: выбранный режим переживает перезапуск
 * (web → localStorage, native → SecureStore — тот же сплит, что у
 * сессии Supabase в src/services/auth.ts; AsyncStorage в проект не
 * тянем ради одной строки). «Системная» следит за ОС вживую через
 * useColorScheme().
 *
 * Все экраны берут палитру только через useTheme() — прямые импорты
 * палитры ломают переключение (StyleSheet.create на уровне модуля
 * вычисляется один раз). У useTheme() есть фолбэк без провайдера
 * (Appearance.getColorScheme) — им пользуются экраны вне дерева
 * провайдера: ConfigErrorScreen и фолбэк ErrorBoundary.
 */

/** Что выбрал пользователь (сохраняется). */
export type ThemeMode = "system" | "light" | "dark";
/** Во что режим разрешается с учётом системной темы. */
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "futures-tracker-theme";

function isThemeMode(v: unknown): v is ThemeMode {
  return v === "system" || v === "light" || v === "dark";
}

/** Чтение сохранённого режима: web → localStorage, native → SecureStore. */
function readStoredMode(): Promise<ThemeMode | null> {
  if (Platform.OS === "web") {
    try {
      const v = window.localStorage?.getItem(STORAGE_KEY);
      return Promise.resolve(isThemeMode(v) ? v : null);
    } catch {
      return Promise.resolve(null);
    }
  }
  return SecureStore.getItemAsync(STORAGE_KEY)
    .then((v) => (isThemeMode(v) ? v : null))
    .catch(() => null);
}

/** Запись режима (ошибки тишины не ломают: тема — не критичные данные). */
function writeStoredMode(mode: ThemeMode): void {
  if (Platform.OS === "web") {
    try {
      window.localStorage?.setItem(STORAGE_KEY, mode);
    } catch {
      // приватный режим браузера — живём без персистентности
    }
    return;
  }
  SecureStore.setItemAsync(STORAGE_KEY, mode).catch(() => {});
}

interface ThemeContextValue {
  /** Выбранный режим (сохраняется). */
  mode: ThemeMode;
  /** Разрешённая тема: "light" | "dark" (system уже учтён). */
  theme: ResolvedTheme;
  /** Актуальная палитра для разрешённой темы. */
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(mode: ThemeMode, system: string | null | undefined): ResolvedTheme {
  if (mode !== "system") return mode;
  // Системная тема неизвестна (ОС без настроек/SSR) — тёмная, как весь
  // бренд приложения до появления светлой темы.
  return system === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  // Персистентный выбор подгружается после первого кадра: он успевает
  // до контента (автозагрузка сессии держит LoadingScreen дольше), а
  // до его прихода показывается системная тема — разумный дефолт.
  useEffect(() => {
    let mounted = true;
    readStoredMode().then((stored) => {
      if (mounted && stored) setModeState(stored);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    writeStoredMode(next);
  }, []);

  const theme = resolveTheme(mode, system);
  const colors = theme === "light" ? lightColors : darkColors;
  const value = useMemo(
    () => ({ mode, theme, colors, setMode }),
    [mode, theme, colors, setMode],
  );

  return (
    <ThemeContext.Provider value={value}>
      {/* Иконки статус-бара под фон: тёмный фон → светлые иконки. */}
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Доступ к теме. Внутри ThemeProvider — актуальная тема; вне провайдера
 * (ConfigErrorScreen, фолбэк ErrorBoundary) — деградация: системная тема
 * без переключателя. Хук условным быть не может, поэтому фолбэк без
 * useContext-провайдера собран на императивном Appearance.getColorScheme().
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;

  const system = Appearance.getColorScheme();
  const theme = resolveTheme("system", system);
  const colors = theme === "light" ? lightColors : darkColors;
  return {
    mode: "system",
    theme,
    colors,
    setMode: () => {
      // Вне провайдера переключение недоступно — заглушка для типа.
    },
  };
}
