import { API_URL } from "@/shared/config";
import * as SecureStore from "expo-secure-store";

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync("access_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  getTrades: (limit = 500) =>
    request<{ trades: any[]; summary: any[] }>(`/api/trades?limit=${limit}`),
  createTrade: (body: any) =>
    request(`/api/trades`, { method: "POST", body: JSON.stringify(body) }),
  deleteTrade: (id: string) =>
    request(`/api/trades/${id}`, { method: "DELETE" }),
  patchTrade: (id: string, body: any) =>
    request(`/api/trades/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  syncExchange: (exchange: string) =>
    request<{ ok: boolean; upserted: number; error?: string }>(
      `/api/sync/${exchange}`,
    ),

  getConnections: () => request<{ connections: any[] }>(`/api/connections`),
  addConnection: (body: any) =>
    request(`/api/connections`, { method: "POST", body: JSON.stringify(body) }),
  deleteConnection: (exchange: string) =>
    request(`/api/connections/${exchange}`, { method: "DELETE" }),

  getBalance: () => request<{ snapshots: any[] }>(`/api/balance`),
  addBalance: (body: any) =>
    request(`/api/balance`, { method: "POST", body: JSON.stringify(body) }),
  deleteBalance: (id: string) =>
    request(`/api/balance/${id}`, { method: "DELETE" }),
  getBalanceChart: () => request<any>(`/api/balance/chart`),

  getGoal: () => request<{ settings: any }>(`/api/goal`),
  setGoal: (body: any) =>
    request(`/api/goal`, { method: "PUT", body: JSON.stringify(body) }),

  getSubscription: () =>
    request<{ plan: string; status: string }>(`/api/subscription/status`),
};
