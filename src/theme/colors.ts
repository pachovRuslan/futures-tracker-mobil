/**
 * Цветовая палитра приложения (тёмная тема).
 *
 * Все цвета захардкожены — в будущем можно вынести в theme-провайдер
 * для поддержки light/dark переключения.
 */
export const colors = {
  bg: "#0a0d12",
  surface: "#12161d",
  surfaceHover: "#171c25",
  border: "#232a35",
  text: "#e7eaee",
  textMuted: "#8b95a5",
  textFaint: "#5b6473",
  profit: "#2dd4a7",
  profitDim: "#1a3a34",
  loss: "#f0576b",
  lossDim: "#3a1f26",
  accent: "#4c7eff",
  /** Цвет кнопки Google OAuth. */
  googleBlue: "#4285F4",
} as const;

export type ColorName = keyof typeof colors;
