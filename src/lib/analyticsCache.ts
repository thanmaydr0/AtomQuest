import { supabase } from '@/lib/supabase';

// ── Cache configuration ────────────────────────────────
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T = unknown> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

// ── Helpers ────────────────────────────────────────────
function makeKey(fnName: string, params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${String(params[k])}`)
    .join('&');
  return `${fnName}?${sorted}`;
}

// ── Public API ─────────────────────────────────────────

/**
 * Call a Supabase RPC function with in-memory caching.
 * Returns cached data if still within TTL, otherwise fetches fresh.
 */
export async function cachedRpc<T = unknown>(
  fnName: string,
  params: Record<string, unknown> = {},
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const key = makeKey(fnName, params);
  const now = Date.now();

  const entry = cache.get(key);
  if (entry && entry.expiresAt > now) {
    return entry.data as T;
  }

  const { data, error } = await supabase.rpc(fnName, params);
  if (error) throw error;

  cache.set(key, { data, expiresAt: now + ttlMs });
  return data as T;
}

/**
 * Invalidate cache entries matching a function name (or all if no name given).
 */
export function invalidate(fnName?: string): void {
  if (!fnName) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(`${fnName}?`)) {
      cache.delete(key);
    }
  }
}

/**
 * Clear the entire analytics cache.
 */
export function invalidateAll(): void {
  cache.clear();
}
