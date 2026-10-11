/**
 * Цветовые палитры приложения: тёмная и светлая.
 *
 * Тёмная синхронизирована с веб-версией (futures-tracker-lake): глубокий
 * тёмно-синий фон, плоские карточки с 1px-границей, неоново-мятный профит
 * и синий акцент. Тени не используются — разделение элементов только за
 * счёт границ и контраста фона.
 *
 * Светлая — зеркальная по смыслу: те же роли (фон/карточка/граница/…),
 * но на белом; насыщенность profit/loss/accent понижена до читаемых на
 * белом значений (контраст WCAG AA для текста). Обе палитры обязаны
 * совпадать по набору ключей — это гарантирует тип ThemeColors.
 *
 * ⚠️ Палитру НЕ импортируют напрямую экраны: цвета приходят из
 * useTheme() (src/theme/ThemeContext.tsx), иначе светлая тема не
 * подхватится. Прямой импорт остался только у web-оболочки (+html.tsx).
 */
export const darkColors = {
  /** Основной фон приложения (как у веба: #0B0F14). */
  bg: "#0b0f14",
  /** Фон карточек/панелей (#151B23). */
  surface: "#151b23",
  /** Чуть светлее surface — ховеры, теги бирж, чипы. */
  surfaceHover: "#1a2230",
  /** 1px-границы карточек и разделители строк (#1F2937). */
  border: "#1f2937",
  text: "#eaf0f7",
  textMuted: "#8b95a5",
  textFaint: "#5b6473",
  profit: "#00e5a0",
  /** Тёмная «заливка» пилюли LONG — тинт чуть насыщеннее, как на вебе (#1A3D2E). */
  profitDim: "#1a3d2e",
  loss: "#ff4d4d",
  /** Тёмная «заливка» пилюли SHORT (как на вебе: #3D1A1A). */
  lossDim: "#3d1a1a",
  /** Бар чарта «PnL по месяцам»: исторические месяцы (тёмно-бирюзовый веба). */
  chartTeal: "#2dd4a8",
  /** Бар чарта: текущий месяц (циан-акцент веба). */
  chartCurrent: "#22d3ee",
  accent: "#4f8cff",
  /** Тёмная заливка для тегов бирж / бейджа OPEN (синий тинт). */
  accentDim: "#12233d",
  /** Цвет кнопки Google OAuth. */
  googleBlue: "#4285F4",
} as const;

/** Светлая палитра: те же роли, белый фон, приглушённые до AA-контраста. */
export const lightColors: { [K in keyof typeof darkColors]: string } = {
  bg: "#f4f6f9",
  surface: "#ffffff",
  surfaceHover: "#eaeef4",
  border: "#dfe4ec",
  text: "#10151c",
  textMuted: "#5a6572",
  textFaint: "#939ca9",
  profit: "#00a878",
  profitDim: "#d7f5e9",
  loss: "#e5484d",
  lossDim: "#fbe3e3",
  chartTeal: "#14b58c",
  chartCurrent: "#0aa8c9",
  accent: "#2f6fe4",
  accentDim: "#dfe9fb",
  googleBlue: "#4285F4",
};

/** Форма одной палитры (ключи обязаны совпадать у dark и light). */
export type ThemeColors = { [K in keyof typeof darkColors]: string };

/**
 * Совокупная палитра по умолчанию (тёмная). Оставлена для совместимости
 * со старым импортом `import { colors } from "@/theme/colors"` — новые
 * экраны так НЕ пишут, они берут актуальную палитру из useTheme().
 */
export const colors: ThemeColors = darkColors;
