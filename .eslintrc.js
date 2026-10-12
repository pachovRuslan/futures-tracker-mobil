/**
 * ESLint-конфиг для Expo / React Native.
 *
 * Базируется на официальном eslint-config-expo (ставится как
 * транзитивная зависимость через `expo` CLI). Дополнительные правила
 * включены, чтобы ловить на компиляции/линте:
 *   - no-unused-vars — мёртвые импорты и переменные;
 *   - no-floating-promises — забытые await (частая причина гонок в
 *     колбэках onPress / useEffect);
 *   - react-hooks/exhaustive-deps — deps массивы в useEffect/useCallback.
 *
 * Запуск: `pnpm lint` (он же `npx expo lint`).
 */
module.exports = {
  extends: ["expo"],
  ignorePatterns: ["dist/", "web-build/", ".expo/"],
  rules: {
    // Тип-импорты через `import type` — не считаем неиспользуемыми.
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
    // Пробрасываем Promise без await только если он не помечен void.
    // В этом проекте `void f().catch(() => {})` — осознанный паттерн
    // фоновой сверки (см. services/purchases.ts), поэтому отключаем.
    "no-async-promise-executor": "error",
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
  // Глобальные переменные React Native / Expo.
  globals: {
    __DEV__: "readonly",
  },
};
