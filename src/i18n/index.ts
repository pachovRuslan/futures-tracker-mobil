/**
 * Модульный уровень i18n: текущий язык + t()/plural() без React.
 *
 * Зачем модульное состояние помимо контекста: часть строк живёт вне
 * рендера — Alert'ы в колбэках (premiumAlert), описания OAuth-ошибок
 * (services/auth), локаль чисел/дат в shared/trade-model. Провайдер
 * (I18nContext) синхронизирует это состояние при каждом выборе языка
 * ДО перевода состояния React — поэтому standalone t() в рендере после
 * смены языка уже видит новое значение.
 *
 * Дефолт — "ru": приложение русскоязычное, а язык при первом запуске
 * выбирается на экране входа (см. LanguageSelect в app/login.tsx).
 */
import {
  DICTIONARIES,
  type Locale,
  type TranslationKey,
} from "./translations";

let currentLocale: Locale = "ru";

/** Текущий язык модуля (синхронизируется I18nProvider). */
export function getLocale(): Locale {
  return currentLocale;
}

/** Установка языка модуля — вызывается провайдером; наружу не нужна. */
export function setModuleLocale(locale: Locale): void {
  currentLocale = locale;
}

export type TParams = Record<string, string | number>;

/** Перевод ключа с подстановкой "{name}" из params. */
export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: TParams,
): string {
  const dict = DICTIONARIES[locale];
  let text: string = dict[key] ?? DICTIONARIES.ru[key];
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

/** Тип функции перевода (её передают в валидацию форм и т.п.). */
export type TFunction = (key: TranslationKey, params?: TParams) => string;

/** Перевод на текущем языке модуля — работает и вне React. */
export const t: TFunction = (key, params) => translate(getLocale(), key, params);

/**
 * Формы плюрализации: ru — [одна, две-четыре, много], en — [one, other].
 */
export interface PluralForms {
  ru: [one: string, few: string, many: string];
  en: [one: string, other: string];
}

/**
 * Локально-зависимая плюрализация: 1 сделка / 2 сделки / 5 сделок
 * (ru) против 1 trade / 2 trades (en). Читает язык модуля.
 */
export function plural(n: number, forms: PluralForms): string {
  if (currentLocale === "ru") {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return forms.ru[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
      return forms.ru[1];
    }
    return forms.ru[2];
  }
  return n === 1 ? forms.en[0] : forms.en[1];
}

export { DICTIONARIES };
export type { Locale, TranslationKey };
