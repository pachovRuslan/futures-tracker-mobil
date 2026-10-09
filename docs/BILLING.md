# Биллинг Premium: настройка и тестирование

Пошаговый маршрут, чтобы покупка подписки заработала end-to-end: ключи →
сборка → Play-трек → тестовая покупка → бейдж PREMIUM.

Код всей цепочки уже написан и закоммичен (таблица ниже) — правки кода не
нужны, нужны только ключи и настройки внешних сервисов. Заглушка
«Покупка недоступна (EXPO_PUBLIC_REVENUECAT_*)» на пейволле означает ровно
одно: APK собран без RC-ключа. Это kill-switch, а не поломка.

## 1. Как устроена цепочка (уже в коде)

```
приложение                        сайт (Vercel)                внешнее
──────────                        ─────────────                ───────
paywall (планы, покупка) ───────────────────────────────────▶ Google Play
  │  RC SDK: purchasePackage()                                   покупка
  ▼
finalize():
  1) syncEntitlementToServer()
     Bearer JWT ──────────▶ POST /api/billing/sync-entitlement
                               │
                               ▼
                             RC v1 API (секретный sk_...)
                             GET /subscribers/{supabase uuid}
                               │
                               ▼
                             upsert user_entitlements
                             (granted_by = 'revenuecat:play')
  2) useSubscription.refresh(true) ▶ RPC get_my_entitlement ▶ Supabase
        │
        ▼
  бейдж PREMIUM / гейты экранов / лимит FREE 50 сделок
```

При каждом запуске с залогиненным юзером AuthContext вызывает
`initPurchases(user.id)`: RC `logIn(supabase uuid)` + фоновая сверка — так
продления и отмены доезжают без webhook'ов.

| Звено | Файл | Ключ |
|---|---|---|
| RC SDK init + logIn | `src/context/AuthContext.tsx` → `src/services/purchases.ts` | — |
| Пейволл: планы, покупка, restore | `app/paywall.tsx` | — |
| Сверка RC → сервер | сайт `app/api/billing/sync-entitlement/route.ts` | `REVENUECAT_SECRET_API_KEY` (`sk_…`) |
| Чтение статуса для UI | `src/hooks/useSubscription.ts` → RPC `get_my_entitlement` | — |
| SDK-ключ в сборке | `src/shared/config.ts` | `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (`goog_…`) |

Правило downgrade на сервере: понижение премиума — только если он выдан
покупкой (`granted_by LIKE 'revenuecat:%'`). Ручные выдачи и allowlist
сверка не трогает.

`goog_…` — публичный SDK-ключ, осознанно вшивается в бандл (так устроен
RevenueCat, прятать его не нужно). `sk_…` — секретный, живёт только в env
сайта. Не путать местами: `goog_` — в мобильную сборку, `sk_` — на сервер.

## 2. RevenueCat (один раз)

1. [app.revenuecat.com](https://app.revenuecat.com) → создать проект.
2. Project Settings → Apps → Add specific app → Android, package name
   `com.pachovruslan.futurestracker`.
3. Project Settings → API Keys → скопировать два ключа:
   - Public SDK key (Android) `goog_…` → `.env` мобильного репо;
   - v1 Secret API key `sk_…` → переменные сайта (Vercel).
4. Product → Entitlements → создать `premium` (идентификатор именно
   такой — его ждёт сервер в `REVENUECAT_ENTITLEMENT_ID`).
5. Products → после линковки Google Play (шаг 3.3) подтянуть подписки
   из Play (Import from Google Play).
6. Offerings → создать офферинг, сделать его Current, добавить пакеты
   (`$rc_monthly` / `$rc_annual` / …) и привязать их к entitlement
   `premium`.

Пока офферинг пуст или не Current, пейволл показывает
«Тарифы настраиваются» — это тоже штатное состояние, не ошибка.

## 3. Google Play Console (один раз)

1. Все приложения → Создать → package
   `com.pachovruslan.futurestracker`. Для первой загрузки AAB консоль
   попросит минимум метаданных: privacy policy URL (есть на сайте
   `/privacy`), целевую аудиторию и контент-рейтинг.
2. Монетизация → Продукты → Подписки → создать продукты, например
   `premium_month` (месяц) и `premium_year` (год), активировать.
3. Пользователи и разрешения → сервисный аккаунт (Google Cloud IAM) с
   правами «Просмотр финансовых данных» + «Управление заказами и
   подписками», скачать JSON-ключ. В RC: Project Settings →
   Integrations → Google Play → загрузить JSON. **Линковка RC↔Play может
   идти до 24 часов** — запустите заранее, не ждите результата в тот же
   день.
4. Тестирование → Внутреннее тестирование (internal testing) → создать
   трек, загрузить AAB (`eas submit -p android`; в `eas.json` уже
   настроено: track internal, ключ `google-service-account.json`),
   раскатать на тестеров. При первой загрузке Play проведёт через
   мастера Play App Signing — соглашайтесь (ключом подписи управляет
   Play/EAS, это штатный путь).
5. Настройки → Тестирование лицензий → добавить Gmail-аккаунты
   тестеров: покупки идут по тест-карте, реальные деньги не списываются.

## 4. Ключи по местам

Мобильный репо, `.env` (локальные запуски и локальные сборки):

```env
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_XXXXXXXX
```

EAS Build — `EXPO_PUBLIC_*` вшиваются на этапе сборки, варианты:

- `eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value goog_…`
  (действует на все сборки проекта), либо
- блок `env` в профиле `eas.json` (ключ публичный, хранить в репо
  допустимо).

Сайт (Vercel → Settings → Environment Variables):

```env
REVENUECAT_SECRET_API_KEY=sk_XXXXXXXX
REVENUECAT_ENTITLEMENT_ID=premium
```

⚠️ `EXPO_PUBLIC_*` вшиваются в момент сборки: поменяли `.env` —
пересоберите APK (или перезапустите Metro с `--clear`). Старая сборка так
и будет показывать заглушку.

## 5. Какая сборка для какого теста

| Сборка | RC init / logIn / sync | Планы и цены | Покупка |
|---|---|---|---|
| `expo start` + dev-client | да | цены может не отдать | нет |
| Sideloaded APK (dev/preview) | да | цены может не отдать | нет (item unavailable) |
| AAB на internal-треке | да | да | **да** |

Ограничение не наше, а Google Play Billing: покупки работают только для
приложений, установленных из Google Play (internal-трек — самый ранний
доступный вариант). Поэтому полный тест покупки — только через трек.

## 6. Тест-план

### 6.1 Дымовой тест Premium без биллинга (можно сегодня)

Проверить премиум-UX до готовности стора — ручная выдача (миграция 13):

```sql
-- Supabase → SQL Editor; замените email на свой
upsert into public.user_entitlements
  (user_id, email, is_premium, is_allowlisted, expires_at, granted_by, granted_at, note)
select u.id, u.email, true, false, null, 'manual', now(),
       'Выдано вручную: тест premium UX (docs/BILLING.md)'
from auth.users u
where u.email = 'you@example.com'
on conflict (user_id) do update
  set is_premium = true,
      expires_at = null,
      granted_by = 'manual',
      granted_at = now(),
      note = 'Выдано вручную: тест premium UX (docs/BILLING.md)';
```

- [ ] В приложении: Настройки → «DEV · Сверить подписку с магазином»
      (dev-сборка) → бейдж PREMIUM (источник — manual)
- [ ] Экран «Подключения бирж» открывается без пейволла
- [ ] 51-я сделка не блокируется лимитом FREE
- [ ] Откат: `update public.user_entitlements set is_premium = false
      where user_id = '…';` → снова «DEV · Сверить» → бейдж FREE

### 6.2 Полный тест покупки (internal track + license tester)

- [ ] Установить приложение по opt-in-ссылке из внутреннего трека
- [ ] Войти через Google → Настройки → «Перейти на Premium»: пейволл
      показывает планы с ценами из Play
- [ ] Выбрать месяц → «Подписаться» → лист Play с тест-картой → ОК
- [ ] Пейволл закроется редиректом, бейдж PREMIUM
- [ ] SQL: `select is_premium, expires_at, granted_by from
      public.user_entitlements where user_id = '…'` →
      `granted_by = 'revenuecat:play'`
- [ ] RC Dashboard → Customers → `app_user_id` = supabase uuid →
      entitlement `premium` active
- [ ] Отмена: Play Маркет → профиль → Платежи и подписки → отменить →
      в приложении «DEV · Сверить подписку» → бейдж FREE. У тестовых
      подписок продления ускорены (минуты вместо месяцев), отмена
      доезжает быстро
- [ ] «Восстановить покупки» после переустановки → PREMIUM

### 6.3 Ручные проверки звеньев (без приложения)

Серверная сверка:

```bash
curl -s -X POST https://futures-tracker-lake.vercel.app/api/billing/sync-entitlement \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" -d '{}' | jq
# после покупки: {"premium":true,"expiresAt":"…","source":"play"}
# 503 REVENUECAT_NOT_CONFIGURED → на сайте не задан sk_…
```

`<access_token>` — Supabase JWT приложения; проще всего подсмотреть в
dev-сборке (Metro-лог `[purchases]`/Network) заголовок Authorization
запроса `sync-entitlement`.

RC v1 напрямую тем же секретным ключом:

```bash
curl -s https://api.revenuecat.com/v1/subscribers/<supabase_uuid> \
  -H "Authorization: Bearer sk_…" | jq '.subscriber.entitlements'
```

## 7. Симптом → причина → действие

| Симптом | Причина | Действие |
|---|---|---|
| «Покупка недоступна (EXPO_PUBLIC_REVENUECAT_*)» | в сборке нет `goog_`-ключа | `.env` / EAS → пересобрать |
| «Тарифы настраиваются» | ключ есть, офферинг пуст/не Current | RC → Offerings (шаг 2.6) |
| «Загружаем тарифы…» висит | RC недоступен или ключ неверный | Metro-лог `[purchases]`, проверить ключ в RC → API Keys |
| Планы пустые в sideloaded-APK | Play не отдаёт цены не-Play-установке | тестировать через internal-трек |
| Покупка падает «item unavailable» | продукты не Active / трек не раскатан / линковка RC↔Play не завершилась | шаги 3.2–3.4, подождать до 24 ч |
| 503 `REVENUECAT_NOT_CONFIGURED` | нет `sk_…` на сайте | Vercel env → redeploy |
| Купил, бейдж FREE | сверка не дошла (сеть) | «DEV · Сверить подписку»; curl из 6.3 |
| `granted_by = 'revenuecat:unknown'` | RC не нашёл store в подписке (старые/неполные данные) | не критично: чтение статуса не зависит от суффикса |

## 8. Частые вопросы

- **Почему в sideloaded dev-APK покупка не работает?** Play Billing
  работает только для приложений, установленных из Google Play.
  Выкатите AAB на internal-трек и ставьте по opt-in-ссылке.
- **Правда ждать 24 часа?** Линковка RC↔Google Play официально до 24 ч.
  Продукты и офферинг можно готовить параллельно.
- **Можно закоммитить `goog_` в репо?** Да, это публичный ключ (он и так
  вшит в каждый APK). `sk_` — никогда.
- **Видит ли сервер тестовые (sandbox) покупки?** Да: покупки
  license-тестеров приходят в RC как обычные entitlements — сверка
  `sync-entitlement` работает одинаково.
- **Должны ли совпадать product id?** Да: product id в Play = product id
  в RC; package сборки = `com.pachovruslan.futurestracker`.
