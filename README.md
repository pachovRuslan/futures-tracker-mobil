# Futures Tracker Mobile

Мобильное приложение-трекер фьючерсных сделок (Expo / React Native / Expo Router / Supabase).

- **Auth**: Google OAuth + Sign in with Apple (iOS) через Supabase (PKCE)
- **Данные**: чтение напрямую из Supabase (Row Level Security)
- **Биржи**: подключение API-ключей через серверный REST API (premium)
- **Premium**: подписка через встроенную покупку (RevenueCat), сверка —
  сервером в `user_entitlements`

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
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | Публичный RC-ключ Google Play (`goog_...`) — покупки в Android |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | Публичный RC-ключ App Store (`appl_...`) — покупки в iOS |

> `EXPO_PUBLIC_*` встраиваются в бандл **в момент сборки**. После изменения
> `.env` перезапускайте dev-сервер с `--clear`.

Пример `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
EXPO_PUBLIC_API_URL=https://futures-tracker-lake.vercel.app
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_xxxxxxxxxxxxxxxx
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_xxxxxxxxxxxxxxxx
```

## Настройка RevenueCat (покупка Premium)

1. Создайте проект в [app.revenuecat.com](https://app.revenuecat.com),
   добавьте приложения Android (package `com.pachovruslan.futurestracker`)
   и iOS (bundle id тот же).
2. Заведите продукты-подписки в Google Play Console / App Store Connect и
   подтяните их в RC (Products → Subscriptions), затем создайте entitlement
   с идентификатором `premium` и привяжите продукты к нему.
3. Скопируйте публичные ключи в `.env` (`EXPO_PUBLIC_REVENUECAT_*`).
4. На сайте задайте `REVENUECAT_SECRET_API_KEY` (v1 secret key `sk_...`) и
   `REVENUECAT_ENTITLEMENT_ID=premium` — их использует
   `/api/billing/sync-entitlement`.
5. Пошаговая настройка сторов (Google Play: продукты, internal-трек,
   license-тестеры), сборок с ключами и полный тест-план покупок —
   **docs/BILLING.md**.

Подробнее про серверные переменные биллинга — в `.env.example`
репозитория сайта (futures-tracker).

## Настройка Supabase

1. Выполните `docs/supabase.sql` в SQL Editor (идемпотентно).
2. Authentication → Providers → Google: включите и укажите
   `https://<ref>.supabase.co/auth/v1/callback` в Google Cloud Console
   (тип клиента «Web application»).
3. **Authentication → URL Configuration → Redirect URLs** — добавьте ВСЕ
   redirect URI вашего окружения (см. ниже). Это **самая частая причина
   бага «на вебе работает, в Expo Go — нет»**.

### Redirect URLs по окружениям

| Окружение | Redirect URI | Работает с Supabase? |
|---|---|---|
| Web (localhost:8081) | `http://localhost:8081/auth/callback` | да |
| Expo Go (**tunnel**) | `exp://u.expo.dev/<projectId>/--/auth/callback` | да |
| Expo Go (LAN, IP) | `exp://<LAN-IP>:8081/--/auth/callback` | **НЕТ — см. ниже** |
| Dev build / standalone | `futurestracker://auth/callback` | да |

Актуальный URI для конкретного запуска приложение печатает в консоль
dev-сервера при каждом нативном логине (`[Auth] redirect URI …`).

> ⚠️ **Expo Go по LAN-адресу не работает в принципе.** Supabase (GoTrue)
> отклоняет redirect URL, хост которого — IP-адрес, отличный от `localhost`,
> **ещё до проверки allowlist** (см. `internal/utilities/request.go` →
> `IsRedirectURLValid`, RFC 8252 §7.3). Отклонённый redirect молча
> заменяется на Site URL — браузер уезжает на сайт, и приложение не
> открывается. Поэтому wildcard вида `exp://192.168.0.*:8081/**` в
> Supabase **не помогает и не нужен**.
>
> Рабочие варианты для Expo Go:
> 1. `npx expo start --tunnel` и запись
>      `exp://u.expo.dev/<projectId>/--/auth/callback` в allowlist
>      (`<projectId>` — `extra.eas.projectId` из app.json);
> 2. dev-сборка (`eas build --profile development`) — redirect
>      `futurestracker://auth/callback`, работает как в проде.
>
> В Expo Go с LAN-IP приложение покажет понятную ошибку с этими же
> подсказками (см. `src/services/auth.ts` → `signInWithGoogle`).

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
