# Futures Tracker Mobile

Мобильное приложение для трекинга фьючерсных сделок на криптобиржах. Отслеживайте P&L, win rate, комиссии и фандинг по сделкам с Binance, Bybit, Bitget, MEXC, BingX, Bitunix. Аутентификация через Google, premium-статус через Supabase, авто-синхронизация сделок через API бирж.

**Стек:** Expo SDK 57 · React Native 0.86 · React 19 · TypeScript · Expo Router · Supabase · pnpm

---

## 📱 Возможности

- **Дашборд** — общий P&L, win rate, AVG/trade, активные сделки, P&L за сегодня
- **Сделки** — список последних сделок с фильтрацией по бирже
- **Баланс** — история снапшотов спот- и фьючерс-балансов
- **Подключения бирж** — добавление API-ключей для авто-синхронизации
- **Premium** — через Supabase RPC (`get_my_entitlement`), без In-App Purchases
- **Аутентификация** — Google OAuth через Supabase Auth (PKCE)
- **Тёмная тема** — собственная цветовая схема `#0a0d12`

---

## 📁 Структура проекта

```
futures-tracker-mobile/
├── app/                          # Expo Router (file-based navigation)
│   ├── _layout.tsx              # Root: AuthProvider + ErrorBoundary + auth guard
│   ├── login.tsx                # Экран логина (Google OAuth)
│   ├── auth/callback.tsx        # OAuth callback — обмен кода на сессию
│   ├── paywall.tsx              # Экран Premium
│   ├── connections.tsx          # Подключения бирж
│   ├── +html.tsx                # Web-only HTML template
│   ├── +not-found.tsx           # 404
│   └── (tabs)/                  # Tab navigator
│       ├── _layout.tsx
│       ├── index.tsx            # Дашборд
│       ├── trades.tsx           # Список сделок
│       ├── balance.tsx          # Баланс
│       └── settings.tsx         # Настройки
├── src/
│   ├── context/
│   │   └── AuthContext.tsx      # Единый auth-провайдер (React Context)
│   ├── components/
│   │   ├── ErrorBoundary.tsx    # Ловит ошибки рендеринга
│   │   └── LoadingScreen.tsx
│   ├── hooks/
│   │   ├── useSubscription.ts   # Premium-статус
│   │   └── useTrades.ts         # Загрузка сделок (race-safe)
│   ├── services/
│   │   ├── auth.ts              # Supabase client, OAuth, safeStorage
│   │   ├── api.ts               # REST API клиент (строго типизирован)
│   │   ├── entitlements.ts      # Premium через Supabase RPC
│   │   └── subscriptions.ts     # Stub (RevenueCat отключён)
│   ├── shared/
│   │   ├── config.ts            # ENV-переменные + валидация
│   │   ├── types.ts             # Доменные типы (Trade, Connection, etc.)
│   │   └── trade-model.ts       # Расчёт P&L, форматирование
│   └── theme/
│       └── colors.ts            # Цветовая палитра
├── assets/images/               # Иконки, splash
├── app.json                     # Expo config
├── eas.json                     # EAS Build profiles
├── package.json
├── tsconfig.json
├── babel.config.js
└── pnpm-workspace.yaml          # Overrides для supply-chain policy
```

---

## 🚀 Быстрый старт

### Требования

- **Node.js** ≥ 20 (рекомендуется LTS)
- **pnpm** ≥ 9
- **Expo CLI**: `npm install -g eas-cli`
- **Expo Go** на телефоне (для тестирования без сборки)

### Установка

```bash
git clone https://github.com/pachovRuslan/futures-tracker-mobil.git
cd futures-tracker-mobil
pnpm install
```

### Переменные окружения

Создай `.env` в корне (не коммитить — он в `.gitignore`):

```env
EXPO_PUBLIC_API_URL=https://futures-tracker-lake.vercel.app
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

### Запуск

```bash
pnpm start          # Expo dev server
pnpm web            # Веб-версия
pnpm android        # Android (эмулятор или устройство)
pnpm ios            # iOS (только macOS + Xcode)
pnpm typecheck      # Проверка TypeScript
```

После `pnpm start` отсканируй QR-код приложением **Expo Go**.

---

## 🗄 Настройка Supabase

### 1. Создай проект на [supabase.co](https://supabase.co)

### 2. Таблицы и RPC

См. SQL в [`docs/supabase.sql`](docs/supabase.sql) (создаёт таблицы `trades`, `user_entitlements`, RPC `get_my_entitlement`, RLS-политики).

### 3. Google OAuth

1. **Supabase → Authentication → Providers → Google** — включить, добавить Client ID/Secret из Google Cloud Console
2. **Authentication → URL Configuration → Redirect URLs** — добавить:

```
https://futures-tracker-lake.vercel.app/auth/callback
exp://exp.host/@your-expo-username/futures-tracker-mobile/--/auth/callback
futurestracker://auth/callback
exp://192.168.1.X:8081/--/auth/callback
```

### 4. EAS Secrets (для сборки)

```bash
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://..."
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..."
eas secret:create --name EXPO_PUBLIC_API_URL --value "https://..."
```

### 5. Выдать Premium

```sql
INSERT INTO public.user_entitlements
  (user_id, email, is_premium, is_allowlisted, granted_by, note)
VALUES
  ('USER-UUID', 'user@example.com', true, true, 'admin', 'manual grant');
```

---

## 📦 Сборка APK / AAB

### Development build (с hot reload, для нативных модулей)

```bash
eas build --profile development --platform android
```

### Preview APK (для внутреннего тестирования)

```bash
eas build --profile preview --platform android --clear-cache
```

### Production AAB (для Google Play)

```bash
eas build --profile production --platform android
```

---

## 🧮 Формулы

### Net P&L сделки

```
netPnl = realized_pnl − fee + funding
```

### Win rate

```
winRate = (wins / closed_trades) × 100
```

Сделки с `netPnl = 0` считаются нейтральными и не включаются в wins/losses.

---

## 🎨 Цветовая палитра

| Имя | HEX | Использование |
|---|---|---|
| `bg` | `#0a0d12` | Фон приложения |
| `surface` | `#12161d` | Карточки, поверхности |
| `border` | `#232a35` | Границы |
| `text` | `#e7eaee` | Основной текст |
| `textMuted` | `#8b95a5` | Вторичный текст |
| `textFaint` | `#5b6473` | Подсказки |
| `profit` | `#2dd4a7` | Положительный P&L |
| `loss` | `#f0576b` | Отрицательный P&L |
| `accent` | `#4c7eff` | Кнопки, ссылки |
| `googleBlue` | `#4285F4` | Кнопка Google OAuth |

---

## 🏗 Архитектура

### Auth

Единый `AuthProvider` (React Context) в `app/_layout.tsx` один раз подписывается на `supabase.auth.onAuthStateChange` и раздаёт `user`/`loading`/`login`/`logout` через `useAuth()`.

**OAuth flow (native):**
1. `signInWithGoogle()` получает OAuth URL от Supabase (`skipBrowserRedirect: true`)
2. Открывает системный браузер через `Linking.openURL`
3. Google → Supabase → redirect на `futurestracker://auth/callback?code=...`
4. Expo Router открывает `app/auth/callback.tsx`
5. `useLocalSearchParams()` получает `code`, вызывает `supabase.auth.exchangeCodeForSession(code)`
6. `onAuthStateChange` → `SIGNED_IN` → `AuthProvider` обновляет `user` → редирект на `/`

### Data

- **Trades (dashboard)** — прямой запрос к Supabase (избегает CORS с REST API)
- **Trades (список), Balance, Connections** — через `api.*` (REST, строго типизирован)
- **Premium** — `supabase.rpc("get_my_entitlement")` через `entitlements.ts`

---

## 🚨 Устранение неполадок

### Приложение крашится в Expo Go

В проекте нет нативных модулей (кроме `expo-secure-store`, который работает в Expo Go). Если краш всё равно есть — проверь лог через `adb logcat`:

```bash
adb logcat -c
adb logcat | grep -i "futurestracker ReactNative"
```

### Не возвращается после Google OAuth

Проверь, что redirect URL добавлен в **Supabase → Authentication → URL Configuration → Redirect URLs**. В standalone APK используется `futurestracker://auth/callback`.

### FREE вместо PREMIUM

1. Проверь запись в `user_entitlements` для своего `user_id`
2. Проверь, что RPC `get_my_entitlement` объявлен как `SECURITY DEFINER`
3. Проверь RLS-политики на `user_entitlements`

### EAS Build: supply-chain policy

В `development` и `preview` профилях отключена через `EXPO_NO_SUPPLY_CHAIN_POLICY=1`. В `production` — включена (безопасность).

---

## 📄 Лицензия

MIT — см. [LICENSE](LICENSE).

---

## 👤 Автор

**Ruslan Pachov**
- GitHub: [@pachovRuslan](https://github.com/pachovRuslan)
