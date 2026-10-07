# REFACTORING.md — Полный аудит и рефакторинг

**Дата:** 2026-10-01 · **Базовый коммит:** `a613a9b` (main) · **Проверки:** `tsc --noEmit` — pass (до и после)

---

## 1. Резюме

Проведён полный аудит репозитория `futures-tracker-mobil` (Expo SDK 57 / React Native 0.86 / expo-router / Supabase). Найдено **23 проблемы**, из них **5 критических**. Главный симптом — «на веб-локалхосте авторизация и дашборд работают, в Expo Go — нет» — имеет **не одну, а четыре наложившиеся причины**, и ни одна из них не была видна пользователю из-за молчаливого проглатывания ошибок.

Ключевой вывод по «галлюцинациям ИИ»: git-история (35 коммитов, 12+ из них — циклические `fix:` вокруг одного и того же OAuth-бага) показывает классический паттерн кодогенерации вслепую: выдуманный REST-контракт, выдуманные колонки БД, копипаст-параметры Google OAuth, мёртвый RevenueCat-каркас на 474 строки и UI-тексты, обещающие функции, которых нет в коде.

---

## 2. Главный баг: почему веб работает, а Expo Go — нет

### Причина №1 (конфигурация, 90% вклада): redirect URI Expo Go не добавлен в Supabase

OAuth-flow на нативе строится вокруг `makeRedirectUri({ path: "auth/callback" })`, который возвращает **разные** URI для разных окружений:

| Окружение | Redirect URI |
|---|---|
| Web (localhost) | `http://localhost:8081/auth/callback` |
| **Expo Go (LAN)** | `exp://<LAN-IP>:8081/--/auth/callback` |
| Expo Go (tunnel) | `exp://u.expo.dev/.../--/auth/callback` |
| Dev/standalone build | `futurestracker://auth/callback` |

Supabase принимает redirect **только** из allowlist (Dashboard → Authentication → URL Configuration → Redirect URLs). Web-URL в проекте, судя по симптомам, был добавлен (потому веб и работал), а `exp://`-URL — нет. Итог: Google согласие даёт, Supabase возвращает `403 Callback URL is not allowed`, браузер остаётся на странице ошибки, пользователь вручную его закрывает, `openAuthSessionAsync` возвращает `dismiss` — и код это **молча игнорировал** (см. причину №2). Плюс IP в `exp://`-URL меняется при смене Wi-Fi.

**Лекарство (включено в этот рефакторинг):**
- README: таблица всех redirect URI + wildcard-паттерны (`exp://192.168.0.*:8081/**`);
- приложение теперь **печатает точный redirect URI при каждом нативном логине**;
- при `403/not allowed` пользователь видит читаемое сообщение с инструкцией, а не тишину.

### Причина №2 (код): OAuth-ошибки проглатывались молча

`signInWithGoogle` обрабатывал только «happy path»:
- `res.type === "success"` с `error=` в URL → просто `console.log`;
- `success` **без** `code=` (Supabase вернул URL без кода) → просто `console.log`;
- `dismiss/cancel` → тихий выход (неразличим: пользователь закрыл или редирект не пришёл).

Никакого Alert, никакого фидбека. Кнопка «Войти» просто снова становилась активной. Это и сделало причину №1 недиагностируемой.

### Причина №3 (код, race condition): двойной обмен одноразового PKCE-кода

В Expo Go редирект `exp://.../--/auth/callback` обрабатывают **два** потребителя одновременно:
1. промис `WebBrowser.openAuthSessionAsync` внутри `signInWithGoogle`;
2. экран `/auth/callback`, на который по deep link навигирует expo-router.

Оба вызывали `supabase.auth.exchangeCodeForSession(code)`. PKCE-код **одноразовый**: второй вызов падал с `400 invalid_request` → на экране логина появлялся Alert «Ошибка входа» при фактически установленной сессии (или наоборот). Добавлен `exchangeCodeOnce()`: дедупликация по коду + ожидание сессии поллингом для «опоздавшего» обработчика.

### Причина №4 (код, персистентность): лимит SecureStore 2048 байт

`expo-secure-store` имеет жёсткий лимит значения в 2048 байт. Сессия Supabase с провайдерскими токенами Google может его превышать — на Android такая запись **молча теряется**, и после перезапуска приложения сессии нет (вход «не прилипает»). Реализовано прозрачное чанкование значений по 2000 символов.

### Почему дашборд «не прогружался»

Дашборд читает `trades` напрямую из Supabase (это единственный экран, который так делал — коммит `ab6a92c` «to avoid CORS»). Без сессии (причины №1–№4) guard в `_layout.tsx` отбрасывал на `/login` — до данных дело не доходило. Отдельно: вкладки «Сделки» и «Баланс» были сломаны **везде**, включая веб (см. §3, баг №1), просто на вебе вы смотрели на дашборд.

---

## 3. Критические баги (5)

### Баг №1 — REST-бэкенд-призрак (галлюцинация контракта)

`src/services/api.ts` содержал клиент к API `/api/trades`, `/api/balance`, `/api/connections`, `/api/goal`, `/api/sync/:exchange`. Диагностика продакшн-URL (`curl`):

```
GET /api/trades            → 307 → location: /login   (HTML-страница Next.js)
GET /api/trades + Bearer   → 307 → /login             (токен игнорируется)
OPTIONS (CORS preflight)   → 307 → /login
```

Бэкенд **не реализует этот контракт** — это веб-приложение, редиректящее неавторизованные (cookie-based) запросы на `/login`. `fetch` прозрачно следовал за 307, получал `200 + HTML`, и `res.json()` падал с «Unexpected token <» на вкладках «Сделки», «Баланс», экране «Подключения». Контракт был **выдуман ИИ** и никогда не существовал.

**Исправление:** весь read-path переведён на прямые запросы к Supabase через RLS (как уже делал дашборд); в `api.ts` остались только `connections` (им нужен сервер — хранение API-ключей), добавлена защита от HTML-ответов с читаемой ошибкой. Возврат `/api/trades` и т.п. — только после реальной имплементации на бэкенде.

### Баг №2 — Crash при отсутствии .env

`.env` в `.gitignore`, `.env.example` не существовало. Любой, кто клонировал репо, получал `createClient("", "")` → `supabaseUrl is required` **на уровне модуля**, до монтирования `ErrorBoundary` → белый экран/красный экран без объяснений.

**Исправление:** ленивый singleton `getSupabase()`, экран «Требуется настройка» с инструкцией, `.env.example` добавлен.

### Баги №3–№5 — см. §2 (silent OAuth errors, двойной обмен, SecureStore-лимит).

---

## 4. Высокие и средние баги

| # | Суть | Исправление |
|---|---|---|
| 6 | **Статистика дашборда по 50 записям.** `totalPnl`, `winRate`, `totalTrades` считались по `.limit(50)` → «ОБЩИЙ P&L» занижен при >50 сделках; FREE-гейт (`>=50`) срабатывал по совпадению лимита выборки | Точные `count: "exact"` head-запросы (всего/открытых), агрегаты по ≤500 последним закрытым |
| 7 | **Мёртвая кнопка «Сделка»** — TODO-заглушка при обещании «Добавьте первую сделку» | Новый экран `app/trade/new.tsx` (прямая вставка в Supabase через RLS) |
| 8 | **Тупиковый «Баланс»** — read-only экран с несуществующего API | Прямой Supabase + форма добавления (upsert по дате/типу) + удаление long-press |
| 9 | **Обход premium-гейта** — «Настройки → Подключения бирж» вёл на connections без проверки (гейт был только на кнопке дашборда) | Гейт на уровне экрана (закрывает и deep link) |
| 10 | **Cargo-cult Google-параметры** — `access_type=offline`, `prompt=consent` → экран согласия Google при каждом входе; Supabase они не нужны | Удалены |
| 11 | **Ложный комментарий** в `useTrades`: «AbortController отменяет fetch при unmount» — сигнал никогда не пробрасывался в fetch | Комментарий-ложь удалён, честная защита через `requestIdRef` |
| 12 | **Paywall обещал несуществующие фичи** — «Push-уведомления», «Экспорт CSV» нигде в коде нет | Копирайт приведён к реальным возможностям |
| 13 | **Галлюцинация схемы БД** — комментарий в `types.ts`: «closed_at NOT NULL по схеме» (схема допускает NULL); исторический коммит `056c128` чинил запросы к **выдуманным** колонкам `trades.pnl`, `trades.pnl_percent` | Комментарии исправлены, типы приведены к реальной схеме |
| 14 | **Мёртвый код**: `subscriptions.ts` (RevenueCat-каркас, урезанный до 47-строчного stub), no-op `initSubscriptions()` в `_layout`, неиспользуемые `calculateMonthStats`/`groupTradesByMonth`/`calculateAllTimeWinRate`/`filterTradesByExchanges`, неиспользуемые методы `api.ts`, `getCurrentUser` | Удалены; `trade-model` оставлен только в используемом виде |
| 15 | **Ленивый `import()` в AuthContext** «во избежание циклической зависимости» — цикла не существовало | Статический импорт |
| 16 | **README пустой** (коммит «Update README.md» = 1 символ), нет `.env.example`, ESLint не настроен, CI нет | README написан полностью; `.env.example` добавлен |
| 17 | Смешение EN/RU в UI («Upgrade to Premium» vs «Перейти на Premium») | Приведено к RU |

---

## 5. Археология git: следы ИИ-галлюцинаций

История (`git log --all`) — хрестоматийный пример тупиковой разработки с ИИ:

- **35 коммитов**, из них 12+ — циклические `fix:` одного и того же OAuth-бага (`fix: callback uses Linking.getInitialURL…` → `fix: use useLocalSearchParams…` → `fix: use expo-linking parse()…` → снова `fix: callback uses Linking.getInitialURL…`) — метод менялся наугад, без диагноза.
- **Коммиты-признания:** `ee126ff "fix: apply AI-introduced bug fixes"`, `fe85d5c "fix: remove native modules to fix Expo Go crash"`, `a87dce4 "fix: remove react-native-url-polyfill that causes JSI crash in Hermes"` (в Expo Go нельзя подключать нативные модули — RevenueCat потянул за собой нативный код и ронял Expo Go).
- **Выдуманная схема БД:** `056c128 "fix: dashboard uses api.getTrades instead of non-existent columns"` — ИИ придумал колонки `pnl`, `pnl_percent`.
- **CORS-костыль вместо диагноза:** `ab6a92c "fix: dashboard reads trades directly from Supabase to avoid CORS"` — симптом залечен на одном экране, системная причина (бэкенд-призрак) осталась.
- **Мусор в репо:** 2728-строчный патч-файл `futures-tracker-mobile-fixes-no-nulrmdir.patch` и файл `nulrmdir` закоммичены в дерево (позже удалены).
- **RevenueCat-призрак:** 474 строки интеграции → 47 строк stub → удалён в этом рефакторинге.

---

## 6. Что изменено (по файлам)

```
.env.example                    +NEW — шаблон переменных окружения
README.md                       +103 — полная документация setup + redirect URLs
src/shared/config.ts            isSupabaseConfigured, понятный warn
src/shared/types.ts             TradeRow/PnlFields/TradeInsert; комментарий о closed_at исправлен
src/shared/trade-model.ts       только используемые функции; обобщены под TradeRow
src/services/auth.ts            ЯДРО: chunked SecureStore, lazy getSupabase(),
                                parseOAuthParams, surfacing OAuth-ошибок,
                                exchangeCodeOnce (race-fix), лог redirect URI,
                                удалены cargo-cult queryParams
src/services/api.ts             только connections; guard от HTML/redirect-ответов
src/services/entitlements.ts    getSupabase()
src/services/subscriptions.ts   УДАЛЁН (RevenueCat-призрак)
src/context/AuthContext.tsx     getSupabase(), статические импорты
src/hooks/useTrades.ts          прямой Supabase вместо бэкенда-призрака
app/_layout.tsx                 экран ошибки конфигурации; удалён initSubscriptions;
                                +route trade/new
app/auth/callback.tsx           exchangeCodeOnce, parseOAuthParams (query+fragment)
app/(tabs)/index.tsx            точные counts; агрегаты по 500; useFocusEffect;
                                рабочая кнопка «Сделка»; честный premium-текст
app/(tabs)/trades.tsx           TradeRow
app/(tabs)/balance.tsx          прямой Supabase + добавление/удаление записей
app/trade/new.tsx               +NEW — форма ручной сделки
app/connections.tsx             premium-гейт на уровне экрана
app/paywall.tsx                 честный список фич
```

Итог диффа: **19 файлов, +1352 / −546 строк**. `tsc --noEmit` — 0 ошибок.

---

## 7. Чеклист действий вне кода (обязательно!)

1. **Supabase → Authentication → URL Configuration → Redirect URLs** — добавить:
   - `exp://<ваш-LAN-IP>:8081/--/auth/callback` (или wildcard `exp://192.168.0.*:8081/**`);
   - `futurestracker://auth/callback` (для dev/standalone сборок);
   - `http://localhost:8081/auth/callback` (веб). Актуальный URI приложение печатает в консоль dev-сервера.
2. **Google Cloud Console** → OAuth-клиент (Web application) → Authorized redirect URIs должен содержать `https://<project-ref>.supabase.co/auth/v1/callback`.
3. **Выполнить `docs/supabase.sql`** (если ещё не), включая RPC `get_my_entitlement` — без него `useSubscription` всегда видит FREE.
4. **Решить судьбу `/api/connections`**: на текущем бэкенде его нет (307 → /login). Либо имплементировать (хранение API-ключей бирж — оправданный серверный код), либо временно скрыть экран «Подключения».
   > ✅ Обновление (2026-10-07): resolved — на сайте реализованы `/api/connections`,
   > `/api/sync/[exchange]` и Bearer-JWT-мост для мобилки (коммит «Bearer-JWT
   > auth for mobile API bridge»). Пункт оставлен как история аудита.
5. Создать `.env` из `.env.example` и перезапустить `expo start --clear`.

## 8. Рекомендации (roadmap)

- **Серверный агрегат-RPC** (`get_my_trades_stats`) для P&L/win-rate при >500 сделок — сейчас агрегаты считаются по последним 500.
- **CI**: GitHub Actions с `pnpm typecheck` + `expo lint` (eslint сейчас вообще не настроен).
- **Тесты** на чистые функции `trade-model` (файл уже спроектирован как тестируемый, но тестов 0).
- **Supabase codegen типов** (`supabase gen types`) — убрать `as unknown as` касты.
- Унифицировать web-флоу на ручной обмен кода (сейчас на web работает `detectSessionInUrl`, на native — ручной парсинг).
