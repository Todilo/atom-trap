/**
 * The one place the game touches persistent storage (ADR-0001), so a Capacitor wrap could swap it.
 * Every access is guarded: private windows and blocked site data must not break the game.
 */
const PREFIX = 'atom-trap:';

export interface KeyValueStore {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
}

export const localStore: KeyValueStore = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Storage unavailable: progress just isn't kept.
    }
  },
};

export function memoryStore(): KeyValueStore {
  const data = new Map<string, unknown>();
  return {
    get: <T>(key: string, fallback: T) => (data.has(key) ? (data.get(key) as T) : fallback),
    set: (key, value) => void data.set(key, value),
  };
}
