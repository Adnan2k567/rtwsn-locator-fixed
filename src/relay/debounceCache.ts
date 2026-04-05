const cache = new Map<string, number>();

export const shouldRelay = (userId: string, cooldownMs: number): boolean => {
  const now = Date.now();
  // Sweep stale entries first (older than cooldownMs * 3)
  cache.forEach((ts, key) => { if (now - ts > cooldownMs * 3) cache.delete(key) })
  const lastSeen = cache.get(userId);
  if (lastSeen && now - lastSeen < cooldownMs) return false;
  cache.set(userId, now);
  return true;
}

export const clearCache = (): void => cache.clear();
export const getCacheSize = (): number => cache.size;
export const removeEntry = (userId: string): void => { cache.delete(userId); };
