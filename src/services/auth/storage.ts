import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Storage для сессии Supabase (web → localStorage, native → SecureStore)
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️ expo-secure-store имеет жёсткий лимит 2048 байт на значение. Сессия
// Supabase c провайдерскими токенами Google может его превышать — на Android
// такое значение молча теряется, и сессия «не прилипает» (пользователь
// разлогинивается после перезапуска). Поэтому длинные значения режутся на
// чанки по 2000 символов и собираются обратно при чтении.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Персистентность сессии Supabase. safeStorage — экспорт этого модуля
 * для client.ts; наружу, через auth/index.ts, не переэкспортируется.
 */

const CHUNK_SIZE = 2000;
const chunkKey = (key: string, i: number) => `${key}__${i}`;
const chunksMetaKey = (key: string) => `${key}__chunks`;

async function secureGet(key: string): Promise<string | null> {
  const meta = await SecureStore.getItemAsync(chunksMetaKey(key));
  if (meta == null) return SecureStore.getItemAsync(key);

  const n = Number.parseInt(meta, 10);
  if (!Number.isFinite(n) || n <= 0) return null;

  // Чанки читаем параллельно — операции Android Keystore (аппаратное
  // шифрование, ~200-600мс каждая) независимы, последовательное чтение
  // удлиняло бы «Вход в систему…» на каждое лишнее чтение.
  const parts = await Promise.all(
    Array.from({ length: n }, (_, i) =>
      SecureStore.getItemAsync(chunkKey(key, i)),
    ),
  );
  const value = parts.join("");
  return value || null;
}

async function secureSet(key: string, value: string): Promise<void> {
  await secureRemove(key);

  if (value.length <= CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value);
    return;
  }

  const n = Math.ceil(value.length / CHUNK_SIZE);
  await SecureStore.setItemAsync(chunksMetaKey(key), String(n));
  // Запись чанков параллельно — независимые операции Keystore (см.
  // комментарий в secureGet).
  await Promise.all(
    Array.from({ length: n }, (_, i) =>
      SecureStore.setItemAsync(
        chunkKey(key, i),
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      ),
    ),
  );
}

async function secureRemove(key: string): Promise<void> {
  const meta = await SecureStore.getItemAsync(chunksMetaKey(key));
  if (meta != null) {
    const n = Number.parseInt(meta, 10);
    if (Number.isFinite(n)) {
      // Параллельное удаление (см. secureGet) — ошибки «ключа нет»
      // подавляем как и раньше.
      await Promise.all(
        Array.from({ length: n }, (_, i) =>
          SecureStore.deleteItemAsync(chunkKey(key, i)).catch(() => {}),
        ),
      );
    }
    try {
      await SecureStore.deleteItemAsync(chunksMetaKey(key));
    } catch {
      // ключа нет — ок
    }
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ключа нет — ок
  }
}

export const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.localStorage) {
          return window.localStorage.getItem(key);
        }
        return null;
      }
      return await secureGet(key);
    } catch (e) {
      if (__DEV__) console.warn("[auth] storage.getItem error:", e);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
        return;
      }
      await secureSet(key, value);
    } catch (e) {
      if (__DEV__) console.warn("[auth] storage.setItem error:", e);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(key);
        }
        return;
      }
      await secureRemove(key);
    } catch (e) {
      if (__DEV__) console.warn("[auth] storage.removeItem error:", e);
    }
  },
};
