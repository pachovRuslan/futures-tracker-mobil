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
-- 3. RPC get_my_entitlement
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_entitlement()
RETURNS SETOF public.user_entitlements
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.user_entitlements WHERE user_id = auth.uid();
$$;

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

DROP POLICY IF EXISTS "users_delete_own_balance" ON public.balance_snapshots;
CREATE POLICY "users_delete_own_balance"
  ON public.balance_snapshots FOR DELETE TO authenticated
  USING (user_id = auth.uid());
