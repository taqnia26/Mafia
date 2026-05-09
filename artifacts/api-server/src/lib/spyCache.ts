const SPY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const cache = new Map<string, number>();

function key(spyerId: number, targetId: number): string {
  return `${spyerId}:${targetId}`;
}

export function recordSpy(spyerId: number, targetId: number): void {
  cache.set(key(spyerId, targetId), Date.now());
}

export function hasRecentSpy(spyerId: number, targetId: number): boolean {
  const ts = cache.get(key(spyerId, targetId));
  if (ts == null) return false;
  if (Date.now() - ts > SPY_TTL_MS) {
    cache.delete(key(spyerId, targetId));
    return false;
  }
  return true;
}
