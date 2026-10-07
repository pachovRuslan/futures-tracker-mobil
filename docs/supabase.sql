-- ============================================================================
-- Futures Tracker — схема БД Supabase
-- ============================================================================
-- Выполнить в Supabase Dashboard → SQL Editor.
-- Идемпотентно: можно выполнять повторно (использует CREATE IF NOT EXISTS).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Таблица trades
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trades (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exchange    TEXT NOT NULL,
  external_id TEXT NOT NULL,
  symbol      TEXT NOT NULL,
  side        TEXT NOT NULL CHECK (side IN ('long', 'short')),
  qty         NUMERIC,
  entry_price NUMERIC,
  close_price NUMERIC,
  realized_pnl NUMERIC NOT NULL DEFAULT 0,
  fee         NUMERIC NOT NULL DEFAULT 0,
  funding     NUMERIC NOT NULL DEFAULT 0,
  opened_at   TIMESTAMPTZ,
  closed_at   TIMESTAMPTZ,
  raw         JSONB,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, exchange, external_id)
);

CREATE INDEX IF NOT EXISTS idx_trades_user_closed_at
  ON public.trades (user_id, closed_at DESC);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_trades" ON public.trades;
CREATE POLICY "users_select_own_trades"
  ON public.trades FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_insert_own_trades" ON public.trades;
CREATE POLICY "users_insert_own_trades"
  ON public.trades FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_trades" ON public.trades;
CREATE POLICY "users_update_own_trades"
  ON public.trades FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_delete_own_trades" ON public.trades;
CREATE POLICY "users_delete_own_trades"
  ON public.trades FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Таблица user_entitlements (Premium-статус)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_entitlements (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT,
  is_premium     BOOLEAN NOT NULL DEFAULT false,
  is_allowlisted BOOLEAN NOT NULL DEFAULT false,
  granted_by     TEXT,
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ,
  note           TEXT
);

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_entitlements" ON public.user_entitlements;
CREATE POLICY "users_select_own_entitlements"
  ON public.user_entitlements FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Premium-статус: allowed_emails + ft_is_effective_premium + get_my_entitlement
-- ─────────────────────────────────────────────────────────────────────────────

-- 3a. Таблица allowlist-а сайта (источник правды о входе и премиуме).
-- Точная копия миграции 06 сайта (prod-форма: PK = email).
CREATE TABLE IF NOT EXISTS public.allowed_emails (
  email    TEXT PRIMARY KEY,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note     TEXT
);

ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read allowlist" ON public.allowed_emails;
CREATE POLICY "Anyone authenticated can read allowlist"
  ON public.allowed_emails FOR SELECT TO authenticated
  USING (true);

-- 3b. «Эффективный премиум» — единая функция-источник правды (миграция 10
-- сайта). Премиум = is_premium (не истёк) OR is_allowlisted OR email
-- в allowed_emails.
CREATE OR REPLACE FUNCTION public.ft_is_effective_premium(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      (
        SELECT e.is_premium AND (e.expires_at IS NULL OR e.expires_at > now())
        FROM public.user_entitlements e
        WHERE e.user_id = p_user_id
      ),
      false
    )
    OR COALESCE(
      (
        SELECT e.is_allowlisted
        FROM public.user_entitlements e
        WHERE e.user_id = p_user_id
      ),
      false
    )
    OR EXISTS (
      SELECT 1
      FROM public.allowed_emails a
      JOIN auth.users u ON lower(u.email) = lower(a.email)
      WHERE u.id = p_user_id
    );
$$;

REVOKE ALL ON FUNCTION public.ft_is_effective_premium(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ft_is_effective_premium(UUID) TO authenticated;

-- 3c. RPC для мобильного приложения (миграция 12). LEFT JOIN от auth.users:
-- ровно одна строка для залогиненного юзера (даже без записи в
-- user_entitlements), плюс вычисленный is_effective_premium. Приложение
-- читает его; при отсутствии поля (старая БД) — fallback на is_premium.
-- DROP обязателен: возвращаемый тип меняется (SETOF → TABLE), Postgres
-- не позволяет это через CREATE OR REPLACE (ошибка 42P13).
DROP FUNCTION IF EXISTS public.get_my_entitlement();

CREATE OR REPLACE FUNCTION public.get_my_entitlement()
RETURNS TABLE (
  user_id              UUID,
  email                TEXT,
  is_premium           BOOLEAN,
  is_allowlisted       BOOLEAN,
  is_effective_premium BOOLEAN,
  granted_by           TEXT,
  granted_at           TIMESTAMPTZ,
  expires_at           TIMESTAMPTZ,
  note                 TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.email,
    COALESCE(e.is_premium, false),
    COALESCE(e.is_allowlisted, false),
    public.ft_is_effective_premium(u.id),
    e.granted_by,
    e.granted_at,
    e.expires_at,
    e.note
  FROM auth.users u
  LEFT JOIN public.user_entitlements e ON e.user_id = u.id
  WHERE u.id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.get_my_entitlement() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_entitlement() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Таблица balance_snapshots (опционально — для экрана "Баланс")
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.balance_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('spot', 'futures')),
  value_usd     NUMERIC NOT NULL,
  snapshot_date DATE NOT NULL,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, type, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_balance_user_date
  ON public.balance_snapshots (user_id, snapshot_date DESC);

ALTER TABLE public.balance_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_balance" ON public.balance_snapshots;
CREATE POLICY "users_select_own_balance"
  ON public.balance_snapshots FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_insert_own_balance" ON public.balance_snapshots;
CREATE POLICY "users_insert_own_balance"
  ON public.balance_snapshots FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE обязателен для .upsert(..., { onConflict: "user_id,type,snapshot_date" })
-- в экране «Баланс»: upsert = INSERT ... ON CONFLICT DO UPDATE, и без этой
-- политики повторное сохранение за ту же дату падает с RLS-ошибкой 42501.
DROP POLICY IF EXISTS "users_update_own_balance" ON public.balance_snapshots;
CREATE POLICY "users_update_own_balance"
  ON public.balance_snapshots FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC get_trade_stats — агрегаты биржа × месяц для дашборда
--    (миграция 11; без него дашборд молча падает в fallback-расчёт
--    по последним 500 сделкам — итог занижается при длинной истории)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_trade_stats()
RETURNS TABLE (
  exchange     TEXT,
  month        TEXT,
  trades       BIGINT,
  wins         BIGINT,
  net_pnl      NUMERIC,
  gross_profit NUMERIC,
  gross_loss   NUMERIC,
  fee          NUMERIC,
  funding      NUMERIC
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.exchange,
    to_char(t.closed_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month,
    count(*) AS trades,
    count(*) FILTER (WHERE (t.realized_pnl - t.fee + t.funding) > 0) AS wins,
    sum(t.realized_pnl - t.fee + t.funding) AS net_pnl,
    sum(CASE WHEN (t.realized_pnl - t.fee + t.funding) > 0
             THEN (t.realized_pnl - t.fee + t.funding) ELSE 0 END) AS gross_profit,
    sum(CASE WHEN (t.realized_pnl - t.fee + t.funding) < 0
             THEN (t.realized_pnl - t.fee + t.funding) ELSE 0 END) AS gross_loss,
    sum(t.fee) AS fee,
    sum(t.funding) AS funding
  FROM public.trades t
  WHERE t.closed_at IS NOT NULL
    AND t.user_id = auth.uid()
  GROUP BY
    t.exchange,
    to_char(t.closed_at AT TIME ZONE 'UTC', 'YYYY-MM')
  ORDER BY 1, 2;
$$;

REVOKE ALL ON FUNCTION public.get_trade_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_trade_stats() TO authenticated;

DROP POLICY IF EXISTS "users_delete_own_balance" ON public.balance_snapshots;
CREATE POLICY "users_delete_own_balance"
  ON public.balance_snapshots FOR DELETE TO authenticated
  USING (user_id = auth.uid());
