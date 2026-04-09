export type CacheEnvelope<T> = {
  v: 1;
  fetchedAt: number;
  data: T;
};

export function readCache<T>(key: string): CacheEnvelope<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || parsed.v !== 1 || typeof parsed.fetchedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, env: CacheEnvelope<T>): void {
  try {
    localStorage.setItem(key, JSON.stringify(env));
  } catch {
    // ignore quota / privacy mode errors
  }
}

export function isFresh(fetchedAt: number, ttlMs: number, nowMs = Date.now()): boolean {
  return nowMs - fetchedAt <= ttlMs;
}

