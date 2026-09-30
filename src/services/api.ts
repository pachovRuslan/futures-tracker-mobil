import { getAccessToken } from "@/services/auth";
import { API_URL } from "@/shared/config";
import type {
  BalanceSnapshot,
  Connection,
  CreateConnectionPayload,
  Trade,
  UserSettings,
} from "@/shared/types";

/**
 * REST API клиент.
 *
 * Все методы строго типизированы. Токен берётся из сессии Supabase
 * через getAccessToken() (раньше читался из safeStorage напрямую, что
 * приводило к stale-токенам после autoRefreshToken).
 */

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      message = data.error ?? message;
    } catch {
      // тело не JSON — используем statusText
      if (res.statusText) message = res.statusText;
    }
    throw new ApiError(message, res.status);
  }

  // 204 No Content / пустое тело — не парсим JSON.
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

function put<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "PUT", body: JSON.stringify(body) });
}

function patch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

// ─────────────────────────────────────────────────────────────────────────────
// Trades
// ─────────────────────────────────────────────────────────────────────────────

export interface TradesResponse {
  trades: Trade[];
}

export interface CreateTradePayload {
  exchange: Trade["exchange"];
  symbol: string;
  side: Trade["side"];
  qty?: number;
  entry_price?: number;
  close_price?: number;
  realized_pnl: number;
  fee?: number;
  funding?: number;
  opened_at?: string;
  closed_at: string;
  notes?: string;
}

export type UpdateTradePayload = Partial<CreateTradePayload>;

// ─────────────────────────────────────────────────────────────────────────────
// Connections
// ─────────────────────────────────────────────────────────────────────────────

export interface ConnectionsResponse {
  connections: Connection[];
}

export interface SyncResult {
  ok: boolean;
  upserted: number;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Balance
// ─────────────────────────────────────────────────────────────────────────────

export interface BalanceResponse {
  snapshots: BalanceSnapshot[];
}

export interface CreateBalancePayload {
  type: BalanceSnapshot["type"];
  value_usd: number;
  snapshot_date: string;
  note?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings / goal
// ─────────────────────────────────────────────────────────────────────────────

export interface GoalResponse {
  settings: UserSettings;
}

export interface SetGoalPayload {
  goal_usd: number | null;
  futures_start_usd?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

export const api = {
  // Trades
  getTrades: (limit = 500): Promise<TradesResponse> =>
    request<TradesResponse>(`/api/trades?limit=${limit}`),
  createTrade: (body: CreateTradePayload): Promise<Trade> =>
    post<Trade>("/api/trades", body),
  deleteTrade: (id: string): Promise<void> => del(`/api/trades/${id}`),
  patchTrade: (id: string, body: UpdateTradePayload): Promise<Trade> =>
    patch<Trade>(`/api/trades/${id}`, body),

  // Sync
  syncExchange: (exchange: string): Promise<SyncResult> =>
    request<SyncResult>(`/api/sync/${exchange}`),

  // Connections
  getConnections: (): Promise<ConnectionsResponse> =>
    request<ConnectionsResponse>(`/api/connections`),
  addConnection: (body: CreateConnectionPayload): Promise<Connection> =>
    post<Connection>("/api/connections", body),
  deleteConnection: (exchange: string): Promise<void> =>
    del(`/api/connections/${exchange}`),

  // Balance
  getBalance: (): Promise<BalanceResponse> =>
    request<BalanceResponse>(`/api/balance`),
  addBalance: (body: CreateBalancePayload): Promise<BalanceSnapshot> =>
    post<BalanceSnapshot>("/api/balance", body),
  deleteBalance: (id: string): Promise<void> => del(`/api/balance/${id}`),

  // Settings / goal
  getGoal: (): Promise<GoalResponse> => request<GoalResponse>(`/api/goal`),
  setGoal: (body: SetGoalPayload): Promise<GoalResponse> =>
    put<GoalResponse>("/api/goal", body),
};

export { ApiError };
