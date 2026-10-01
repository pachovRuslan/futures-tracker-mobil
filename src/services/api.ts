import { getAccessToken } from "@/services/auth";
import { API_URL } from "@/shared/config";
import type {
  Connection,
  ConnectionsResponse,
  CreateConnectionPayload,
} from "@/shared/types";

/**
 * REST API клиент — ТОЛЬКО для операций, требующих серверной логики
 * (хранение API-ключей бирж, обращение к биржам от имени сервера).
 *
 * ⚠️ История бага: раньше здесь был полный набор эндпоинтов
 * (/api/trades, /api/balance, /api/goal, /api/sync/:exchange), которого
 * НЕ СУЩЕСТВУЕТ на бэкенде — тот отвечает 307-редиректом на /login
 * (HTML), а не JSON. Чтение данных переведено на прямые запросы к
 * Supabase (RLS), здесь остались только connections.
 *
 * ⚠️ Прежде чем вернуть сюда /api/trades и т.п. — убедитесь, что
 * бэкенд реально имплементирует контракт (см. REFACTORING.md).
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

  // 204 No Content — не парсим JSON.
  if (res.status === 204) {
    return undefined as T;
  }

  // Защита от «бэкенда-призрака»: fetch прозрачно следует за 307-редиректом
  // (например, на /login web-приложения) и возвращает 200 + HTML. Без этой
  // проверки res.json() падал бы с невнятным "Unexpected token <".
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError(
      `API вернул ${contentType || "не-JSON"} вместо JSON. ` +
        `Похоже, EXPO_PUBLIC_API_URL (${API_URL}) не реализует ${path}.`,
      res.status,
    );
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

// ─────────────────────────────────────────────────────────────────────────────
// Connections (требуют сервер — хранение API-ключей бирж)
// ─────────────────────────────────────────────────────────────────────────────

export const api = {
  getConnections: (): Promise<ConnectionsResponse> =>
    request<ConnectionsResponse>(`/api/connections`),
  addConnection: (body: CreateConnectionPayload): Promise<Connection> =>
    post<Connection>("/api/connections", body),
  deleteConnection: (exchange: string): Promise<void> =>
    del(`/api/connections/${exchange}`),
};

export { ApiError };
