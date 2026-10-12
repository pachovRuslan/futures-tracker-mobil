# Futures Tracker Mobile

Мобильное приложение-трекер фьючерсных сделок (Expo / React Native / Expo Router / Supabase).

- **Auth**: Google OAuth + Sign in with Apple (iOS) через Supabase (PKCE)
- **Данные**: чтение и запись напрямую в Supabase (Row Level Security)
- **Биржи**: подключение API-ключей и синк сделок через серверный REST API (premium)
- **Premium**: подписка через встроенную покупку (RevenueCat), сверка — сервером в `user_entitlements`
- **i18n**: русский + английский, плюрализация, выбор сохраняется

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
| `EXPO_PUBLIC_API_URL` | REST-бэкенд для подключений бирж и сверки Premium |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | Публичный RC-ключ Google Play (`goog_...`) |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | Публичный RC-ключ App Store (`appl_...`) |

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

1. Выполните `docs/supabase.sql` в SQL Editor (идемпотентно — включает
   все таблицы, RLS-политики, RPC и триггеры).
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
> подсказками (см. `src/services/auth/oauth.ts` → `signInWithGoogle`).

## Структура

```
app/                        # экраны (expo-router)
  _layout.tsx               # root: ErrorBoundary + I18nProvider + ThemeProvider
                            #       + AuthProvider + guard навигации
  login.tsx                 # вход через Google / Sign in with Apple
  auth/callback.tsx         # OAuth callback (cold/warm start)
  +html.tsx                 # веб-оболочка (только web)
  +not-found.tsx            # 404
  (tabs)/
    _layout.tsx             # нижняя навигация
    index.tsx               # Дашборд
    trades.tsx              # Сделки
    balance.tsx             # Баланс
    settings.tsx            # Настройки
  trade/new.tsx             # ручное добавление сделки
  trade/edit.tsx            # редактирование сделки / заметки
  connections.tsx           # подключение бирж (premium, REST)
  paywall.tsx               # экран Premium

src/
  services/
    auth/                   # Supabase-клиент, OAuth Google, Sign in with Apple,
                            #   персистентность сессии (chunked SecureStore)
      index.ts              # баррель — публичный API модуля
      client.ts             # lazy singleton getSupabase(), signOut, getAccessToken
      oauth.ts               # OAuth-флоу Google (PKCE), redirect URI, exchangeCodeOnce
      apple.ts              # Sign in with Apple
      storage.ts            # safeStorage (web localStorage / native SecureStore с чанками)
    api.ts                  # REST-клиент: connections + sync-bridge
    entitlements.ts         # RPC get_my_entitlement + кэш 60с
    purchases.ts            # мост RevenueCat ↔ сервер (initPurchases, sync, packages)
  context/
    AuthContext.tsx         # единый AuthProvider, onAuthStateChange, init/reset RC
  hooks/
    useTrades.ts            # список сделок (Supabase)
    useBalanceSnapshots.ts  # снапшоты баланса + удаление
    useSubscription.ts      # статус Premium с кэшем
    useEditableTrade.ts     # загрузка сделки для редактирования
    useTradeMutations.ts    # update / saveNotes / delete
    useDashboardStats.ts    # агрегаты + ряд графика (RPC + fallback)
    useDashboardSync.ts     # ручной синк с биржами с дашборда
    useConnectionsSync.ts   # ручной синк с экрана подключений
    usePaywallActions.ts    # покупка / restore / сверка
  components/
    TradeForm.tsx           # общая форма сделки (новая + редактирование)
    TrendLoader.tsx         # анимация загрузки
    LoadingScreen.tsx
    ErrorBoundary.tsx
    balance/                # BalanceForm, BalanceRow
    connections/            # AddConnectionForm, ExchangeRow, SyncAllBox, premiumAlert
    dashboard/              # DashboardHeader, HeroCard, StatsGrid, PnlChart,
                            #   RecentTrades, ActionButtons, PremiumBanner,
                            #   ExchangeFilterChips
    paywall/                # PlansCard, BuyButton, RestoreButton, FeaturesCard, LegalNote
    trade/                  # TradeSummaryCard, TradeNotesForm
  i18n/
    index.ts                # модульный уровень: locale, t(), plural()
    I18nContext.tsx         # провайдер + хук useI18n (с деградацией без провайдера)
    LanguageSelect.tsx      # сегмент выбора языка
    translations.ts         # словари ru/en с типизированными ключами
  theme/
    colors.ts               # тёмная и светлая палитры, тип ThemeColors
    ThemeContext.tsx        # провайдер + хук useTheme (с деградацией)
  shared/
    config.ts               # env-переменные, kill-switch фич, лимиты
    types.ts                # доменные типы (Trade, Balance, Connection, Entitlement)
    trade-model.ts          # чистые функции: net P&L, форматирование чисел/дат
    datetime.ts             # парсинг "YYYY-MM-DD HH:MM" → ISO

docs/
  supabase.sql              # полная схема БД: таблицы, RLS, RPC, триггеры
  BILLING.md                # настройка и тест-план биллинга
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
   сессию — см. чанкование SecureStore в `src/services/auth/storage.ts`
   (лимит 2048 байт на значение).
