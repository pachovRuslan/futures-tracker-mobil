# Futures Tracker Mobile

Мобильное приложение-трекер фьючерсных сделок (Expo / React Native / Expo Router / Supabase).

- **Auth**: Google OAuth через Supabase (PKCE)
- **Данные**: чтение напрямую из Supabase (Row Level Security)
- **Биржи**: подключение API-ключей через серверный REST API (premium)
- **Premium**: выдаётся вручную через таблицу `user_entitlements`

## Быстрый старт

```bash
pnpm install
cp .env.example .env   # заполните значения (см. ниже)
npx expo start         # Expo Go / dev-client
npx expo start --web   # веб-версия на localhost:8081
```

## Переменные окружения (`.env`)

| Переменная | Назначение |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL проекта Supabase (`https://<ref>.supabase.co`) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | anon key проекта |
| `EXPO_PUBLIC_API_URL` | REST-бэкенд для подключений бирж (optional) |

> `EXPO_PUBLIC_*` встраиваются в бандл **в момент сборки**. После изменения
> `.env` перезапускайте dev-сервер с `--clear`.

Пример `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
EXPO_PUBLIC_API_URL=https://futures-tracker-lake.vercel.app
```

## Настройка Supabase

1. Выполните `docs/supabase.sql` в SQL Editor (идемпотентно).
2. Authentication → Providers → Google: включите и укажите
   `https://<ref>.supabase.co/auth/v1/callback` в Google Cloud Console
   (тип клиента «Web application»).
3. **Authentication → URL Configuration → Redirect URLs** — добавьте ВСЕ
   redirect URI вашего окружения (см. ниже). Это **самая частая причина
   бага «на вебе работает, в Expo Go — нет»**.

### Redirect URLs по окружениям

| Окружение | Redirect URI |
|---|---|
| Web (localhost) | `http://localhost:8081/auth/callback` |
| Expo Go (LAN) | `exp://<ваш-LAN-IP>:8081/--/auth/callback` |
| Expo Go (tunnel) | `exp://u.expo.dev/<project-id>/--/auth/callback` |
| Dev build / standalone | `futurestracker://auth/callback` |

Актуальный URI для конкретного запуска приложение печатает в консоль
dev-сервера при каждом нативном логине (`[Auth] redirect URI …`).

> ⚠️ IP-адрес в Expo Go меняется при смене Wi-Fi сети — используйте
> wildcard-паттерн в Supabase, например `exp://192.168.0.*:8081/**`,
> либо добавляйте актуальный адрес.

## Структура

```
app/                    # экраны (expo-router)
  _layout.tsx           # root layout: AuthProvider + guard навигации
  login.tsx             # вход через Google
  auth/callback.tsx     # OAuth callback (cold/warm start)
  (tabs)/               # Дашборд / Сделки / Баланс / Настройки
  trade/new.tsx         # ручное добавление сделки
  connections.tsx       # подключение бирж (premium, REST)
  paywall.tsx           # экран Premium
src/
  services/auth.ts      # Supabase client (lazy) + OAuth flow
  services/api.ts       # REST клиент (только connections)
  services/entitlements.ts
  context/AuthContext.tsx
  hooks/                # useTrades, useSubscription
  shared/               # типы, константы, чистая логика расчётов
docs/supabase.sql       # схема БД + RLS
```

## Скрипты

```bash
pnpm start        # expo start
pnpm typecheck    # tsc --noEmit
pnpm lint         # expo lint
```

## Отладка входа через Google

1. Откройте терминал dev-сервера — приложение логирует redirect URI
   и результат auth-сессии.
2. Если после согласия Google браузер показывает
   «Callback URL is allowed» / 403 — redirect URI не добавлен в Supabase
   (см. таблицу выше).
3. Если вход проходит, но после перезапуска приложение «забывает»
   сессию — см. чанкование SecureStore в `src/services/auth.ts`
   (лимит 2048 байт на значение).

Подробный отчёт о найденных и исправленных багах: `REFACTORING.md`.
