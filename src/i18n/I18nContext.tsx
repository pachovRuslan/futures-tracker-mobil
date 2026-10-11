import { setModuleLocale, t, plural, getLocale } from "./index";
import type { Locale, TFunction } from "./index";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
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
 * Язык интерфейса: ru / en.
 *
 * Паттерн повторяет ThemeContext: выбор переживает перезапуск
 * (web → localStorage, native → SecureStore — тот же сплит, что у
 * темы и сессии). I18nProvider дополнительно синхронизирует модульное
 * состояние src/i18n/index.ts — им пользуются строки вне рендера
 * (Alert'ы в сервисах, локаль чисел/дат) и фолбэк вне провайдера.
 *
 * Дефолт — "ru"; при первом запуске язык выбирается сегментом на
 * экране входа (первый экран до авторизации), затем тот же выбор
 * доступен в настройках.
 */

const STORAGE_KEY = "futures-tracker-locale";

function isLocale(v: unknown): v is Locale {
  return v === "ru" || v === "en";
}

/** Чтение сохранённого языка: web → localStorage, native → SecureStore. */
function readStoredLocale(): Promise<Locale | null> {
  if (Platform.OS === "web") {
    try {
      const v = window.localStorage?.getItem(STORAGE_KEY);
      return Promise.resolve(isLocale(v) ? v : null);
    } catch {
      return Promise.resolve(null);
    }
  }
  return SecureStore.getItemAsync(STORAGE_KEY)
    .then((v) => (isLocale(v) ? v : null))
    .catch(() => null);
}

/** Запись языка (ошибки тишины не ломают: язык — не критичные данные). */
function writeStoredLocale(locale: Locale): void {
  if (Platform.OS === "web") {
    try {
      window.localStorage?.setItem(STORAGE_KEY, locale);
    } catch {
      // приватный режим браузера — живём без персистентности
    }
    return;
  }
  SecureStore.setItemAsync(STORAGE_KEY, locale).catch(() => {});
}

interface I18nContextValue {
  /** Текущий язык. */
  locale: Locale;
  /** Смена языка (сохраняется и применяется сразу). */
  setLocale: (locale: Locale) => void;
  /** Перевод (тот же standalone t — после смены языка рендер читает
   *  обновлённое модульное состояние). */
  t: TFunction;
  /** Локально-зависимая плюрализация. */
  plural: typeof plural;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ru");

  // Персистентный выбор подгружается после первого кадра (как тема):
  // до его прихода интерфейс на дефолтном "ru" — разумное молчание.
  useEffect(() => {
    let mounted = true;
    readStoredLocale().then((stored) => {
      if (mounted && stored) {
        setLocaleState(stored);
        setModuleLocale(stored);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Смена языка: state (ре-рендер подписчиков) + модуль (строки вне
  // рендера) + хранилище (перезапуск) — синхронно и в одном месте.
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    setModuleLocale(next);
    writeStoredLocale(next);
  }, []);

  const value = useMemo(
    () => ({ locale, setLocale, t, plural }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Доступ к языку. Внутри I18nProvider — актуальный язык; вне провайдера
 * (краш-экран ErrorBoundary: провайдеры уже размонтированы) — последнее
 * синхронизированное модульное значение, т.е. выбранный пользователем
 * язык сохраняется и на экране ошибки.
 */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return {
    locale: getLocale(),
    setLocale: setModuleLocale,
    t,
    plural,
  };
}
