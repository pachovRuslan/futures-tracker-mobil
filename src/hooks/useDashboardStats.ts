import { useAuth } from "@/context/AuthContext";
import { getSupabase } from "@/services/auth";
import { TRADES_PAGE_SIZE } from "@/shared/config";
import type { TradeRow } from "@/shared/types";
import { tradeNetPnl } from "@/shared/trade-model";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

export type LoadState = "idle" | "loading" | "refreshing" | "error" | "empty";

/** Колонки, нужные списку «Последние сделки» (без тяжёлого JSONB raw). */
const LIST_SELECT = [
  "id",
  "exchange",
  "symbol",
  "side",
  "qty",
  "entry_price",
  "close_price",
  "realized_pnl",
  "fee",
  "funding",
  "opened_at",
  "closed_at",
  "notes",
].join(", ");

/**
 * Колонки для агрегатов: P&L, win-rate, комиссии, фандинг, месячный ряд.
 * exchange — для клиентского фильтра по биржам (чипы «БИРЖИ В PNL»).
 */
const STATS_SELECT = [
  "exchange",
  "realized_pnl",
  "fee",
  "funding",
  "closed_at",
].join(", ");

type ClosedRow = {
  exchange: string;
  realized_pnl: number;
  fee: number;
  funding: number;
  closed_at: string | null;
};

/**
 * Строка RPC get_trade_stats() (миграция 11): агрегаты биржа × месяц
 * по ВСЕМ закрытым сделкам — вместо клиентского расчёта по последним
 * TRADES_PAGE_SIZE, который занижал итог у трейдеров с >500 сделками.
 */
interface StatsRow {
  exchange: string;
  /** "YYYY-MM" */
  month: string;
  trades: number;
  wins: number;
  net_pnl: number;
  gross_profit: number;
  gross_loss: number;
  fee: number;
  funding: number;
}

/**
 * Fallback-расчёт (RPC недоступен — миграция 11 не применена):
 * те же строки StatsRow, посчитанные на клиенте по последним N
 * закрытым сделкам. Форма данных идентична — весь код ниже
 * не различает источник.
 */
function aggregateClosedToStats(rows: ClosedRow[]): StatsRow[] {
  const map = new Map<string, StatsRow>();
  for (const t of rows) {
    if (t.closed_at == null) continue;
    const month = t.closed_at.slice(0, 7);
    const key = `${t.exchange}|${month}`;
    const row =
      map.get(key) ??
      {
        exchange: t.exchange,
        month,
        trades: 0,
        wins: 0,
        net_pnl: 0,
        gross_profit: 0,
        gross_loss: 0,
        fee: 0,
        funding: 0,
      };
    const pnl = tradeNetPnl(t);
    row.trades += 1;
    if (pnl > 0) row.wins += 1;
    row.net_pnl += pnl;
    if (pnl > 0) row.gross_profit += pnl;
    else row.gross_loss += pnl;
    row.fee += t.fee;
    row.funding += t.funding;
    map.set(key, row);
  }
  return Array.from(map.values());
}

const MONTH_LABELS = [
  "ЯНВ",
  "ФЕВ",
  "МАР",
  "АПР",
  "МАЙ",
  "ИЮН",
  "ИЮЛ",
  "АВГ",
  "СЕН",
  "ОКТ",
  "НОЯ",
  "ДЕК",
];

const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Минимум месяцев на графике — окно «последние 6» даже без данных. */
export const CHART_MIN_MONTHS = 6;
/** Максимум месяцев: при большей истории график скроллится (как расширяющийся на сайте),
 *  но не рисует сотни баров — сейчас кап 2 года. */
export const CHART_MAX_MONTHS = 24;

/** Точка ряда бар-чарта «PnL по месяцам» (см. PnlChart). */
export interface MonthlyBar {
  key: string;
  label: string;
  value: number;
  isCurrent: boolean;
}

/** Агрегат «всё время» (с учётом фильтра по бирже). */
export interface AllTimeAggregate {
  net: number;
  grossProfit: number;
  grossLoss: number;
  fees: number;
  funding: number;
  count: number;
  winRate: number;
}

/** Агрегат выбранного/текущего месяца. */
export interface MonthAggregate {
  net: number;
  grossProfit: number;
  grossLoss: number;
  count: number;
  winRate: number;
}

export interface UseDashboardStatsResult {
  state: LoadState;
  errorMsg: string | null;
  /** Перезагрузка данных: pull-to-refresh, после синка, повтор при ошибке. */
  loadDashboard: (isRefresh?: boolean) => Promise<void>;
  /** Экран в фокусе? Guard для долгих внешних операций (ручной синк). */
  mountedRef: RefObject<boolean>;
  trades: TradeRow[];
  /** Уникальные биржи с данными (для чипов фильтра). */
  exchanges: string[];
  /** Последние сделки с учётом фильтра биржи (список на дашборде). */
  filteredRecent: TradeRow[];
  allTime: AllTimeAggregate;
  month: MonthAggregate;
  /** Месяц сетки статистики: выбранный на графике или текущий. */
  monthTitle: string;
  monthly: MonthlyBar[];
  totalCount: number;
}

/**
 * useDashboardStats — данные дашборда: загрузка из Supabase (список
 * сделок + точный COUNT + агрегаты RPC get_trade_stats с fallback) и
 * все производные агрегаты/ряды для hero-карточки, сетки статистики и
 * бар-чарта. Выделен из app/(tabs)/index.tsx при декомпозиции бог-файла;
 * логика перенесена без изменений.
 */
export function useDashboardStats(
  exchangeFilter: string,
  selectedMonth: string | null,
): UseDashboardStatsResult {
  const { user } = useAuth();

  const [trades, setTrades] = useState<TradeRow[]>([]);
  /** Агрегаты биржа × месяц: из RPC get_trade_stats (по ВСЕМ сделкам)
   *  либо fallback-расчёт по последним TRADES_PAGE_SIZE закрытым. */
  const [statRows, setStatRows] = useState<StatsRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      if (!user?.id) {
        setState("empty");
        return;
      }

      setState(isRefresh ? "refreshing" : "loading");
      setErrorMsg(null);

      try {
        const supabase = getSupabase();

        // ⚠️ История бага: раньше ВСЯ статистика считалась по последним 50
        // сделкам (.limit(50)) — из-за этого «ОБЩИЙ P&L» и «СДЕЛОК» были
        // занижены для пользователей с >50 сделками. Волна 2: агрегаты
        // берутся из серверного RPC get_trade_stats (миграция 11) по ВСЕМ
        // закрытым сделкам; totalTrades — точный COUNT (head-запрос).
        // Если RPC недоступен (миграция не применена) — fallback на
        // клиентский расчёт по последним TRADES_PAGE_SIZE, как в волне 1.
        const [list, countRes, rpcRes] = await Promise.all([
          supabase
            .from("trades")
            .select(LIST_SELECT)
            .order("closed_at", { ascending: false, nullsFirst: false })
            .limit(50),
          supabase.from("trades").select("id", { head: true, count: "exact" }),
          supabase.rpc("get_trade_stats"),
        ]);

        const listError = list.error ?? countRes.error;
        if (listError) throw new Error(listError.message);

        let rows: StatsRow[];
        if (rpcRes.error || !rpcRes.data) {
          if (__DEV__) {
            console.warn(
              "[Dashboard] get_trade_stats RPC недоступен, fallback на последние",
              TRADES_PAGE_SIZE,
              "сделок:",
              rpcRes.error?.message,
            );
          }
          const legacy = await supabase
            .from("trades")
            .select(STATS_SELECT)
            .not("closed_at", "is", null)
            .order("closed_at", { ascending: false })
            .limit(TRADES_PAGE_SIZE);
          if (legacy.error) throw new Error(legacy.error.message);
          rows = aggregateClosedToStats(
            (legacy.data ?? []) as unknown as ClosedRow[],
          );
        } else {
          rows = rpcRes.data as unknown as StatsRow[];
        }

        if (!mountedRef.current) return;

        setTrades((list.data ?? []) as unknown as TradeRow[]);
        setStatRows(rows);
        setTotalCount(countRes.count ?? list.data?.length ?? 0);
        setState(
          (countRes.count ?? 0) > 0 || (list.data?.length ?? 0) > 0
            ? "idle"
            : "empty",
        );
      } catch (e) {
        if (!mountedRef.current) return;
        if (__DEV__) console.error("[Dashboard] load error:", e);
        setErrorMsg(e instanceof Error ? e.message : "Неизвестная ошибка");
        setState("error");
      }
    },
    [user?.id],
  );

  // Перезагрузка при каждом появлении экрана (после добавления сделки,
  // возврата с других табов) вместо одноразового mount-эффекта.
  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      loadDashboard();
      return () => {
        mountedRef.current = false;
      };
    }, [loadDashboard]),
  );

  // ── Фильтр по биржам (чипы «БИРЖИ В PNL», как на вебе) ───────────────────

  const exchanges = useMemo(() => {
    const set = new Set<string>();
    for (const t of trades) set.add(t.exchange);
    for (const r of statRows) set.add(r.exchange);
    return Array.from(set).sort();
  }, [trades, statRows]);

  const filteredRows = useMemo(
    () =>
      exchangeFilter === "all"
        ? statRows
        : statRows.filter((r) => r.exchange === exchangeFilter),
    [statRows, exchangeFilter],
  );

  const filteredRecent = useMemo(
    () =>
      exchangeFilter === "all"
        ? trades
        : trades.filter((t) => t.exchange === exchangeFilter),
    [trades, exchangeFilter],
  );

  // ── Агрегаты: всё время + текущий месяц (сетка статистики 3×3) ───────────

  const now = useMemo(() => new Date(), []);
  const curMonthKey = monthKey(now);
  /** Месяц в сетке статистики: выбранный на графике или текущий. */
  const activeMonthKey = selectedMonth ?? curMonthKey;

  const allTime = useMemo(() => {
    let net = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let fees = 0;
    let funding = 0;
    let count = 0;
    let wins = 0;
    for (const r of filteredRows) {
      net += r.net_pnl;
      grossProfit += r.gross_profit;
      grossLoss += r.gross_loss;
      fees += r.fee;
      funding += r.funding;
      count += r.trades;
      wins += r.wins;
    }
    return {
      net,
      grossProfit,
      grossLoss,
      fees,
      funding,
      // Семантика wins — как на сайте и в RPC: net_pnl > 0.
      winRate: count > 0 ? (wins / count) * 100 : 0,
      // При фильтре «все» показываем totalCount (включая открытые
      // позиции) — это же число гейтит FREE-лимит.
      count: exchangeFilter === "all" ? totalCount : count,
    };
  }, [filteredRows, totalCount, exchangeFilter]);

  const month = useMemo(() => {
    let net = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let count = 0;
    let wins = 0;
    for (const r of filteredRows) {
      if (r.month !== activeMonthKey) continue;
      net += r.net_pnl;
      grossProfit += r.gross_profit;
      grossLoss += r.gross_loss;
      count += r.trades;
      wins += r.wins;
    }
    return {
      net,
      grossProfit,
      grossLoss,
      count,
      winRate: count > 0 ? (wins / count) * 100 : 0,
    };
  }, [filteredRows, activeMonthKey]);

  // ── Ряд для бар-чарта «PnL по месяцам» (последние 6 месяцев) ─────────────

  const monthly = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const r of filteredRows) {
      byMonth.set(r.month, (byMonth.get(r.month) ?? 0) + r.net_pnl);
    }

    // Диапазон графика: от самого старого месяца с данными до текущего.
    // Как на сайте — график «расширяется», когда истории больше полугода;
    // при >CHART_MAX_MONTHS месяцев рисуем последнее окно (кап — чтобы не
    // строить сотни баров). Минимум — окно в 6 месяцев, как было раньше.
    let monthsBack = CHART_MIN_MONTHS - 1;
    if (byMonth.size > 0) {
      // Формат "YYYY-MM" сортируется лексикографически как дата.
      const oldestKey = [...byMonth.keys()].sort()[0];
      const [y, m] = oldestKey.split("-").map(Number);
      const back =
        (now.getFullYear() - y) * 12 + (now.getMonth() - (m - 1));
      monthsBack = Math.min(
        Math.max(back, CHART_MIN_MONTHS - 1),
        CHART_MAX_MONTHS - 1,
      );
    }

    const series: Array<{ key: string; label: string; value: number; isCurrent: boolean }> = [];
    for (let i = monthsBack; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d);
      series.push({
        key,
        label: MONTH_LABELS[d.getMonth()],
        value: byMonth.get(key) ?? 0,
        isCurrent: key === curMonthKey,
      });
    }
    return series;
  }, [filteredRows, now, curMonthKey]);

  return {
    state,
    errorMsg,
    loadDashboard,
    mountedRef,
    trades,
    exchanges,
    filteredRecent,
    allTime,
    month,
    monthTitle: activeMonthKey,
    monthly,
    totalCount,
  };
}
