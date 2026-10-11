/**
 * Словари интерфейса: ru (основной, типы ключей выводятся из него) + en.
 *
 * Соглашения:
 *   - ключи плоские "namespace.key" — легко грепаются и сортируются;
 *   - en обязан покрыть ВСЕ ключи ru (тип Record<TranslationKey, string>
 *     даёт ошибку компиляции при пропуске);
 *   - параметры подстановки — "{name}" (см. translate в src/i18n/index.ts);
 *   - названия бирж, LONG/SHORT, FREE/PREMIUM, OPEN-бейдж и бренд
 *     FUTURES TRACKER не переводятся;
 *   - названия языков в селекторах показываются на самом языке
 *     (lang.* — словари не зависят от текущего языка).
 */

/** Языки интерфейса. */
export type Locale = "ru" | "en";

/** Варианты для селекторов (label — на самом языке, не переводится). */
export const LANGUAGES: ReadonlyArray<{ value: Locale; label: string }> = [
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
];

export const ru = {
  // ── common ───────────────────────────────────────────────────────────
  "common.cancel": "Отмена",
  "common.delete": "Удалить",
  "common.yes": "Да",
  "common.later": "Позже",
  "common.retry": "Повторить",
  "common.back": "Назад",
  "common.close": "Закрыть",
  "common.error": "Ошибка",
  "common.loadFailed": "Не удалось загрузить",
  "common.upgrade": "Перейти на Premium",
  "common.privacy": "Политика конфиденциальности",
  "common.terms": "Условия использования",

  // ── login ────────────────────────────────────────────────────────────
  "login.subtitle": "Личный трекер фьючерсных сделок",
  "login.google": "Войти через Google",
  "login.hint": "Вход только для пользователей из allowlist",
  "login.errorTitle": "Ошибка входа",
  "login.errorFallback": "Не удалось войти",

  // ── auth callback ────────────────────────────────────────────────────
  "auth.progress": "Вход в систему...",
  "auth.slow":
    "Завершаем вход — на медленной сети это может занять до минуты…",
  "auth.exchangeFailed": "Не удалось завершить вход",
  "auth.oauthError": "Ошибка авторизации",
  "auth.timeoutTitle": "Вход не завершён",
  "auth.timeoutBody":
    "Обмен ключами затянулся более чем на минуту. Попробуйте войти ещё раз.",
  "auth.supabaseRedirect":
    "Supabase отклонил redirect (403 / Callback URL not allowed). " +
    "Добавьте текущий redirect URI в Supabase Dashboard → Authentication → " +
    "URL Configuration → Redirect URLs (URI см. в консоли выше).",
  "auth.loginFailed": "Вход не выполнен: {code} — {desc}",
  "auth.noDesc": "нет описания",
  "auth.errNoOAuthUrl": "Supabase не вернул OAuth URL",
  "auth.errCantOpenBrowser": "Не удаётся открыть браузер для авторизации",
  "auth.errRedirectNoCode":
    "Supabase вернул redirect без кода авторизации. Проверьте, что redirect " +
    "URI \"{url}\" добавлен в Supabase → Auth → Redirect URLs.",
  "auth.errSessionTimeout": "Таймаут ожидания сессии после обмена кода",
  "auth.errAppleIosOnly": "Sign in with Apple доступен только на iOS",
  "auth.errAppleNotConfigured":
    "Apple ID не настроен на устройстве (Настройки → [имя] → Вход с Apple).",
  "auth.errAppleNoToken": "Apple не вернул identity token — попробуйте ещё раз",

  // ── табы ─────────────────────────────────────────────────────────────
  "tabs.dashboard": "Дашборд",
  "tabs.trades": "Сделки",
  "tabs.balance": "Баланс",
  "tabs.settings": "Настройки",

  // ── дашборд ──────────────────────────────────────────────────────────
  "dash.loading": "Загрузка дашборда…",
  "dash.heroLabel": "ИТОГ ПО СДЕЛКАМ",
  "dash.sync": "Синхрон.",
  "dash.syncing": "Синк…",
  "dash.syncA11y": "Синхронизировать сделки с биржами",
  "dash.allExchanges": "Все биржи",
  "dash.statsTitle": "СТАТИСТИКА {month}",
  "dash.resetMonth": "Сбросить месяц",
  "dash.recent": "ПОСЛЕДНИЕ СДЕЛКИ",
  "dash.viewAll": "Все сделки →",
  "dash.emptyTitle": "Пока нет сделок",
  "dash.emptyDesc":
    "Нажмите «Сделка», чтобы добавить первую и начать отслеживать P&L",
  "dash.actionTrade": "Сделка",
  "dash.actionExchange": "Биржа",
  "dash.chipsLabel": "БИРЖИ В PNL",
  "dash.chipsAll": "Все",
  "dash.tradeOpen": "открыта",

  // ── сетка статистики ─────────────────────────────────────────────────
  "stat.trades": "СДЕЛОК",
  "stat.profitLoss": "ПРИБЫЛЬ / УБЫТОК",
  "stat.winRate": "WIN-RATE",
  "stat.monthTotal": "ИТОГ МЕСЯЦА",
  "stat.totalProfit": "ОБЩАЯ ПРИБЫЛЬ",
  "stat.totalLoss": "ОБЩИЙ УБЫТОК",
  "stat.fees": "КОМИССИИ",
  "stat.funding": "ФАНДИНГ",
  "stat.winRateAll": "WIN-RATE ЗА ВСЁ ВРЕМЯ",

  // ── график PnL по месяцам ────────────────────────────────────────────
  "chart.title": "PNL ПО МЕСЯЦАМ",
  "chart.monthsShort": "мес.",

  // ── месяцы (короткие подписи баров) ──────────────────────────────────
  "month.1": "ЯНВ",
  "month.2": "ФЕВ",
  "month.3": "МАР",
  "month.4": "АПР",
  "month.5": "МАЙ",
  "month.6": "ИЮН",
  "month.7": "ИЮЛ",
  "month.8": "АВГ",
  "month.9": "СЕН",
  "month.10": "ОКТ",
  "month.11": "НОЯ",
  "month.12": "ДЕК",

  // ── премиум-баннер / гейт ────────────────────────────────────────────
  "premium.bannerTitle": "Upgrade to Premium",
  "premium.bannerDesc": "Авто-синк сделок с бирж · Безлимит ручных сделок",
  "premium.requiredTitle": "Требуется Premium",
  "premium.requiredMsg":
    "Подключения бирж и авто-синк доступны по подписке Premium.",

  // ── статусы ручного синка (дашборд и подключения) ────────────────────
  "sync.disabled": "Синк с биржами временно отключён.",
  "sync.loadingConnections": "Загружаю список подключений…",
  "sync.noConnectionsDash":
    "Нет подключённых бирж — добавьте API-ключи через кнопку «Биржа».",
  "sync.noConnectionsConn": "Нет подключённых бирж — добавьте ключ ниже.",
  "sync.syncingOne": "Синк {exchange}…",
  "sync.progress": "Синк: {exchange} ({i}/{n})…",
  "sync.doneOne": "{exchange}: обновлено {count} записей",
  "sync.done": "Готово — обновлено {count} записей",
  "sync.doneWithErrors": "Обновлено {count} записей. Ошибки: {errors}",
  "sync.failShort": "сбой",
  "sync.failShort2": "не удалось",

  // ── список сделок ────────────────────────────────────────────────────
  "trades.loading": "Загрузка сделок…",
  "trades.empty": "Сделок пока нет",
  "trades.deleteTitle": "Удалить сделку?",
  "trades.deleteMsg": "{symbol} — действие необратимо.",
  "trades.editAction": "Редактировать",
  "trades.noteAction": "Изменить заметку",

  // ── экраны сделки ────────────────────────────────────────────────────
  "trade.newTitle": "Новая сделка",
  "trade.editTitle": "Редактирование сделки",
  "trade.save": "Сохранить",
  "trade.saveChanges": "Сохранить изменения",
  "trade.loading": "Загрузка сделки…",
  "trade.notFound": "Сделка не найдена",
  "trade.deleteButton": "Удалить сделку",
  "trade.freeLimitTitle": "Лимит бесплатного плана",
  "trade.freeLimitMsg":
    "В FREE можно вести до {limit} сделок. Premium снимает ограничение.",
  "trade.checkFields": "Проверьте поля",
  "trade.notesHint":
    "Сделка синхронизируется с биржи — следующий синк перезапишет " +
    "поля. Доступно редактирование только заметки.",
  "trade.saveNote": "Сохранить заметку",
  "trade.wordOpened": "открыта",
  "trade.wordClosed": "закрыта",

  // ── форма сделки ─────────────────────────────────────────────────────
  "form.symbol": "Тикер *",
  "form.direction": "Направление",
  "form.qty": "Кол-во",
  "form.pnl": "P&L, USDT *",
  "form.entry": "Entry",
  "form.close": "Close",
  "form.fee": "Комиссия",
  "form.funding": "Funding",
  "form.opened": "Открыта",
  "form.closed": "Закрыта",
  "form.notes": "Заметки",
  "form.now": "сейчас",
  "form.dtPlaceholder": "ГГГГ-ММ-ДД ЧЧ:ММ",
  "form.closePlaceholder": "пусто = открыта",
  "form.closedPlaceholder": "пусто = как открыта/сейчас",
  "form.notesPlaceholder": "Опционально",
  "form.fieldPnl": "P&L",
  "form.fieldQty": "Количество",
  "form.fieldFee": "Комиссия",
  "form.vSymbol": "Укажите тикер (например, BTCUSDT).",
  "form.vNumeric": "{field} должен быть числом.",
  "form.vOpenedFormat":
    "Дата открытия: формат ГГГГ-ММ-ДД ЧЧ:ММ (например, 2026-10-05 14:30).",
  "form.vClosedFormat":
    "Дата закрытия: формат ГГГГ-ММ-ДД ЧЧ:ММ (например, 2026-10-05 14:30).",
  "form.vClosedBeforeOpened": "Дата закрытия раньше даты открытия.",

  // ── баланс ───────────────────────────────────────────────────────────
  "balance.loading": "Загрузка баланса…",
  "balance.spotTitle": "Спот-баланс",
  "balance.futuresTitle": "Фьючерсный депозит",
  "balance.empty": "Нет записей",
  "balance.hint":
    "Долгое нажатие на записи — удаление. Одна запись на тип и дату " +
    "(повторное сохранение обновляет её).",
  "balance.add": "+ Записать баланс",
  "balance.collapse": "Свернуть форму",
  "balance.spot": "Спот",
  "balance.futures": "Фьючерс",
  "balance.amount": "Сумма, USD",
  "balance.date": "Дата",
  "balance.datePlaceholder": "ГГГГ-ММ-ДД",
  "balance.note": "Заметка",
  "balance.deleteTitle": "Удалить запись",
  "balance.deleteMsg": "{value} от {date}?",
  "balance.vAmount": "Сумма должна быть числом.",
  "balance.vDate": "Дата должна быть в формате ГГГГ-ММ-ДД.",

  // ── подключения бирж ─────────────────────────────────────────────────
  "conn.loading": "Загрузка подключений…",
  "conn.title": "Подключения",
  "conn.add": "Добавить",
  "conn.disconnect": "Отключить",
  "conn.disconnectMsg": "Отключить {exchange}?",
  "conn.notConnected": "не подключено",
  "conn.syncAll": "Синк все биржи",
  "conn.exchange": "Биржа",
  "conn.apiKeyPlaceholder": "Введите API Key",
  "conn.apiSecretPlaceholder": "Введите API Secret",
  "conn.passphrasePlaceholder": "Третий ключ из API-настроек Bitget",
  "conn.passphraseHint":
    "{exchange} выдаёт три ключа при создании API-ключа: " +
    "Key, Secret и Passphrase.",
  "conn.checking": "Проверка...",

  // ── пейволл ──────────────────────────────────────────────────────────
  "paywall.subtitle": "Раскрой полный потенциал трекера сделок",
  "paywall.premiumActive": "Premium активен. Перенаправляем…",
  "paywall.buyFor": "Подписаться за {price}",
  "paywall.restore": "Восстановить покупки",
  "paywall.buyUnavailableTitle": "Покупка недоступна",
  "paywall.buyUnavailableText":
    "В этой сборке не заданы ключи магазина (EXPO_PUBLIC_REVENUECAT_*). " +
    "Premium можно активировать в сборке с настроенным биллингом.",
  "paywall.account": "Аккаунт: {email}",
  "paywall.plansLoading": "Загружаем тарифы…",
  "paywall.plansPendingTitle": "Тарифы настраиваются",
  "paywall.plansPendingText":
    "Подписка скоро появится в магазине. Уже покупали? Восстановите " +
    "покупку кнопкой ниже.",
  "paywall.autoRenew": "Автопродление · отмена в любой момент",
  "paywall.legal":
    "Оплата списывается с вашего счёта в магазине после подтверждения. " +
    "Подписка продлевается автоматически, пока не отменена в настройках " +
    "Google Play / App Store. Управление подпиской — в аккаунте магазина.",
  "paywall.restoredMsg":
    "Покупки восстановлены. Если Premium не активировался — проверьте " +
    "аккаунт стора.",

  // ── тарифы ───────────────────────────────────────────────────────────
  "plan.month": "1 месяц",
  "plan.year": "1 год",
  "plan.week": "1 неделя",
  "plan.forever": "Навсегда",

  // ── что входит в Premium ─────────────────────────────────────────────
  "feature.syncTitle": "Авто-синк бирж",
  "feature.syncDesc":
    "Подключите API-ключи — Binance, Bybit, Bitget, MEXC, BingX подтянут " +
    "сделки сами",
  "feature.unlimitedTitle": "Безлимит сделок",
  "feature.unlimitedDesc": "FREE — до 50 сделок, Premium — без ограничений",

  // ── настройки ────────────────────────────────────────────────────────
  "settings.themeTitle": "Тема оформления",
  "settings.themeSystem": "Системная",
  "settings.themeLight": "Светлая",
  "settings.themeDark": "Тёмная",
  "settings.language": "Язык",
  "settings.connections": "Подключения бирж",
  "settings.logout": "Выйти",
  "settings.deleteAccount": "Удалить аккаунт",
  "settings.deleteTitle": "Удалить аккаунт?",
  "settings.deleteMsg":
    "Будут безвозвратно удалены: профиль, все сделки, снимки баланса, " +
    "подключения бирж и подписка Premium. Это действие нельзя отменить.",
  "settings.deleteForever": "Удалить навсегда",
  "settings.deleteFailed": "Не удалось удалить аккаунт",
  "settings.devSync": "DEV · Сверить подписку с магазином",
  "settings.devSyncTitle": "Сверка подписки",
  "settings.devSyncError":
    "Сервер/RC недоступны ({error}).\nСтатус перечитан из user_entitlements — смотрите бейдж.",
  "settings.devSyncOk":
    "RevenueCat: premium={premium}.\nСтатус в приложении обновлён — смотрите бейдж.",

  // ── 404 / краш-экран / экран конфигурации ────────────────────────────
  "notFound.title": "Не найдено",
  "notFound.text": "Экран не найден",
  "notFound.back": "На главную",
  "errorScreen.title": "Что-то пошло не так",
  "errorScreen.subtitle":
    "Приложение столкнулось с неожиданной ошибкой. Попробуйте снова.",
  "errorScreen.retry": "Попробовать снова",
  "errorScreen.unknown": "Неизвестная ошибка",
  "config.title": "Требуется настройка",
  "config.varsIntro": "Не заданы переменные окружения Supabase:",
  "config.text":
    "Создайте файл .env в корне проекта (см. README.md), затем " +
    "перезапустите dev-сервер:",
} as const;

export type TranslationKey = keyof typeof ru;

export const en: Record<TranslationKey, string> = {
  // ── common ───────────────────────────────────────────────────────────
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.yes": "Yes",
  "common.later": "Later",
  "common.retry": "Retry",
  "common.back": "Back",
  "common.close": "Close",
  "common.error": "Error",
  "common.loadFailed": "Failed to load",
  "common.upgrade": "Upgrade to Premium",
  "common.privacy": "Privacy Policy",
  "common.terms": "Terms of Use",

  // ── login ────────────────────────────────────────────────────────────
  "login.subtitle": "Your personal futures trades tracker",
  "login.google": "Sign in with Google",
  "login.hint": "Sign-in is available to allowlisted users only",
  "login.errorTitle": "Sign-in error",
  "login.errorFallback": "Could not sign in",

  // ── auth callback ────────────────────────────────────────────────────
  "auth.progress": "Signing in...",
  "auth.slow":
    "Finishing sign-in — on a slow connection this may take up to a minute…",
  "auth.exchangeFailed": "Could not complete sign-in",
  "auth.oauthError": "Authorization error",
  "auth.timeoutTitle": "Sign-in not completed",
  "auth.timeoutBody":
    "Key exchange took more than a minute. Please try signing in again.",
  "auth.supabaseRedirect":
    "Supabase rejected the redirect (403 / Callback URL not allowed). " +
    "Add the current redirect URI in Supabase Dashboard → Authentication → " +
    "URL Configuration → Redirect URLs (see the URI in the console above).",
  "auth.loginFailed": "Sign-in failed: {code} — {desc}",
  "auth.noDesc": "no description",
  "auth.errNoOAuthUrl": "Supabase did not return an OAuth URL",
  "auth.errCantOpenBrowser": "Could not open the browser for sign-in",
  "auth.errRedirectNoCode":
    "Supabase returned a redirect without an authorization code. Check that " +
    "redirect URI \"{url}\" is added in Supabase → Auth → Redirect URLs.",
  "auth.errSessionTimeout": "Timed out waiting for the session after code exchange",
  "auth.errAppleIosOnly": "Sign in with Apple is available on iOS only",
  "auth.errAppleNotConfigured":
    "Apple ID is not set up on the device (Settings → [your name] → Sign in with Apple).",
  "auth.errAppleNoToken": "Apple did not return an identity token — please try again",

  // ── табы ─────────────────────────────────────────────────────────────
  "tabs.dashboard": "Dashboard",
  "tabs.trades": "Trades",
  "tabs.balance": "Balance",
  "tabs.settings": "Settings",

  // ── дашборд ──────────────────────────────────────────────────────────
  "dash.loading": "Loading dashboard…",
  "dash.heroLabel": "TOTAL P&L",
  "dash.sync": "Sync",
  "dash.syncing": "Syncing…",
  "dash.syncA11y": "Sync trades with exchanges",
  "dash.allExchanges": "All exchanges",
  "dash.statsTitle": "STATISTICS {month}",
  "dash.resetMonth": "Reset month",
  "dash.recent": "RECENT TRADES",
  "dash.viewAll": "All trades →",
  "dash.emptyTitle": "No trades yet",
  "dash.emptyDesc":
    "Tap “Trade” to add your first one and start tracking P&L",
  "dash.actionTrade": "Trade",
  "dash.actionExchange": "Exchange",
  "dash.chipsLabel": "EXCHANGES IN PNL",
  "dash.chipsAll": "All",
  "dash.tradeOpen": "open",

  // ── сетка статистики ─────────────────────────────────────────────────
  "stat.trades": "TRADES",
  "stat.profitLoss": "PROFIT / LOSS",
  "stat.winRate": "WIN-RATE",
  "stat.monthTotal": "MONTH TOTAL",
  "stat.totalProfit": "TOTAL PROFIT",
  "stat.totalLoss": "TOTAL LOSS",
  "stat.fees": "FEES",
  "stat.funding": "FUNDING",
  "stat.winRateAll": "LIFETIME WIN-RATE",

  // ── график PnL по месяцам ────────────────────────────────────────────
  "chart.title": "PNL BY MONTH",
  "chart.monthsShort": "mo.",

  // ── месяцы (короткие подписи баров) ──────────────────────────────────
  "month.1": "JAN",
  "month.2": "FEB",
  "month.3": "MAR",
  "month.4": "APR",
  "month.5": "MAY",
  "month.6": "JUN",
  "month.7": "JUL",
  "month.8": "AUG",
  "month.9": "SEP",
  "month.10": "OCT",
  "month.11": "NOV",
  "month.12": "DEC",

  // ── премиум-баннер / гейт ────────────────────────────────────────────
  "premium.bannerTitle": "Upgrade to Premium",
  "premium.bannerDesc":
    "Auto-sync trades from exchanges · Unlimited manual trades",
  "premium.requiredTitle": "Premium required",
  "premium.requiredMsg":
    "Exchange connections and auto-sync are available with a Premium subscription.",

  // ── статусы ручного синка ────────────────────────────────────────────
  "sync.disabled": "Exchange sync is temporarily disabled.",
  "sync.loadingConnections": "Loading connections…",
  "sync.noConnectionsDash":
    "No exchanges connected — add API keys with the “Exchange” button.",
  "sync.noConnectionsConn": "No exchanges connected — add a key below.",
  "sync.syncingOne": "Syncing {exchange}…",
  "sync.progress": "Syncing: {exchange} ({i}/{n})…",
  "sync.doneOne": "{exchange}: {count} records updated",
  "sync.done": "Done — {count} records updated",
  "sync.doneWithErrors": "Updated {count} records. Errors: {errors}",
  "sync.failShort": "failed",
  "sync.failShort2": "failed",

  // ── список сделок ────────────────────────────────────────────────────
  "trades.loading": "Loading trades…",
  "trades.empty": "No trades yet",
  "trades.deleteTitle": "Delete trade?",
  "trades.deleteMsg": "{symbol} — this cannot be undone.",
  "trades.editAction": "Edit",
  "trades.noteAction": "Edit note",

  // ── экраны сделки ────────────────────────────────────────────────────
  "trade.newTitle": "New trade",
  "trade.editTitle": "Edit trade",
  "trade.save": "Save",
  "trade.saveChanges": "Save changes",
  "trade.loading": "Loading trade…",
  "trade.notFound": "Trade not found",
  "trade.deleteButton": "Delete trade",
  "trade.freeLimitTitle": "Free plan limit",
  "trade.freeLimitMsg":
    "The FREE plan allows up to {limit} trades. Premium removes the limit.",
  "trade.checkFields": "Check the fields",
  "trade.notesHint":
    "This trade is synced from an exchange — the next sync will " +
    "overwrite its fields. Only the note is editable.",
  "trade.saveNote": "Save note",
  "trade.wordOpened": "opened",
  "trade.wordClosed": "closed",

  // ── форма сделки ─────────────────────────────────────────────────────
  "form.symbol": "Symbol *",
  "form.direction": "Direction",
  "form.qty": "Qty",
  "form.pnl": "P&L, USDT *",
  "form.entry": "Entry",
  "form.close": "Close",
  "form.fee": "Fee",
  "form.funding": "Funding",
  "form.opened": "Opened",
  "form.closed": "Closed",
  "form.notes": "Notes",
  "form.now": "now",
  "form.dtPlaceholder": "YYYY-MM-DD HH:MM",
  "form.closePlaceholder": "empty = open",
  "form.closedPlaceholder": "empty = same as opened/now",
  "form.notesPlaceholder": "Optional",
  "form.fieldPnl": "P&L",
  "form.fieldQty": "Qty",
  "form.fieldFee": "Fee",
  "form.vSymbol": "Enter a symbol (e.g. BTCUSDT).",
  "form.vNumeric": "{field} must be a number.",
  "form.vOpenedFormat":
    "Opened date: format YYYY-MM-DD HH:MM (e.g. 2026-10-05 14:30).",
  "form.vClosedFormat":
    "Closed date: format YYYY-MM-DD HH:MM (e.g. 2026-10-05 14:30).",
  "form.vClosedBeforeOpened": "Close date is before open date.",

  // ── баланс ───────────────────────────────────────────────────────────
  "balance.loading": "Loading balance…",
  "balance.spotTitle": "Spot balance",
  "balance.futuresTitle": "Futures deposit",
  "balance.empty": "No records",
  "balance.hint":
    "Long-press a record to delete it. One record per type and date " +
    "(saving again updates it).",
  "balance.add": "+ Record balance",
  "balance.collapse": "Collapse form",
  "balance.spot": "Spot",
  "balance.futures": "Futures",
  "balance.amount": "Amount, USD",
  "balance.date": "Date",
  "balance.datePlaceholder": "YYYY-MM-DD",
  "balance.note": "Note",
  "balance.deleteTitle": "Delete record",
  "balance.deleteMsg": "{value} on {date}?",
  "balance.vAmount": "Amount must be a number.",
  "balance.vDate": "Date must be in YYYY-MM-DD format.",

  // ── подключения бирж ─────────────────────────────────────────────────
  "conn.loading": "Loading connections…",
  "conn.title": "Connections",
  "conn.add": "Add",
  "conn.disconnect": "Disconnect",
  "conn.disconnectMsg": "Disconnect {exchange}?",
  "conn.notConnected": "not connected",
  "conn.syncAll": "Sync all exchanges",
  "conn.exchange": "Exchange",
  "conn.apiKeyPlaceholder": "Enter API Key",
  "conn.apiSecretPlaceholder": "Enter API Secret",
  "conn.passphrasePlaceholder": "The third key from Bitget API settings",
  "conn.passphraseHint":
    "{exchange} issues three keys when creating an API key: " +
    "Key, Secret and Passphrase.",
  "conn.checking": "Checking...",

  // ── пейволл ──────────────────────────────────────────────────────────
  "paywall.subtitle": "Unlock the full power of your trades tracker",
  "paywall.premiumActive": "Premium is active. Redirecting…",
  "paywall.buyFor": "Subscribe for {price}",
  "paywall.restore": "Restore purchases",
  "paywall.buyUnavailableTitle": "Purchase unavailable",
  "paywall.buyUnavailableText":
    "This build has no store keys configured (EXPO_PUBLIC_REVENUECAT_*). " +
    "Premium can be activated in a build with billing configured.",
  "paywall.account": "Account: {email}",
  "paywall.plansLoading": "Loading plans…",
  "paywall.plansPendingTitle": "Plans are being set up",
  "paywall.plansPendingText":
    "The subscription will appear in the store soon. Already purchased? " +
    "Restore your purchase with the button below.",
  "paywall.autoRenew": "Auto-renewal · cancel anytime",
  "paywall.legal":
    "Payment is charged to your store account after confirmation. The " +
    "subscription renews automatically until cancelled in Google Play / " +
    "App Store settings. Manage it in your store account.",
  "paywall.restoredMsg":
    "Purchases restored. If Premium did not activate — check your " +
    "store account.",

  // ── тарифы ───────────────────────────────────────────────────────────
  "plan.month": "1 month",
  "plan.year": "1 year",
  "plan.week": "1 week",
  "plan.forever": "Lifetime",

  // ── что входит в Premium ─────────────────────────────────────────────
  "feature.syncTitle": "Exchange auto-sync",
  "feature.syncDesc":
    "Connect your API keys — Binance, Bybit, Bitget, MEXC, BingX will " +
    "pull trades automatically",
  "feature.unlimitedTitle": "Unlimited trades",
  "feature.unlimitedDesc": "FREE — up to 50 trades, Premium — unlimited",

  // ── настройки ────────────────────────────────────────────────────────
  "settings.themeTitle": "Theme",
  "settings.themeSystem": "System",
  "settings.themeLight": "Light",
  "settings.themeDark": "Dark",
  "settings.language": "Language",
  "settings.connections": "Exchange connections",
  "settings.logout": "Log out",
  "settings.deleteAccount": "Delete account",
  "settings.deleteTitle": "Delete account?",
  "settings.deleteMsg":
    "This will permanently delete your profile, all trades, balance " +
    "snapshots, exchange connections and Premium subscription. This " +
    "action cannot be undone.",
  "settings.deleteForever": "Delete forever",
  "settings.deleteFailed": "Could not delete account",
  "settings.devSync": "DEV · Verify subscription with the store",
  "settings.devSyncTitle": "Subscription verification",
  "settings.devSyncError":
    "Server/RC unavailable ({error}).\nStatus re-read from user_entitlements — see the badge.",
  "settings.devSyncOk":
    "RevenueCat: premium={premium}.\nApp status updated — see the badge.",

  // ── 404 / краш-экран / экран конфигурации ────────────────────────────
  "notFound.title": "Not found",
  "notFound.text": "Screen not found",
  "notFound.back": "Go home",
  "errorScreen.title": "Something went wrong",
  "errorScreen.subtitle":
    "The app encountered an unexpected error. Please try again.",
  "errorScreen.retry": "Try again",
  "errorScreen.unknown": "Unknown error",
  "config.title": "Setup required",
  "config.varsIntro": "Supabase environment variables are not set:",
  "config.text":
    "Create a .env file in the project root (see README.md), then " +
    "restart the dev server:",
};

/** Словарь по языку (ru — источник типов, en проверяется на полноту). */
export const DICTIONARIES: Record<Locale, Record<TranslationKey, string>> = {
  ru,
  en,
};
