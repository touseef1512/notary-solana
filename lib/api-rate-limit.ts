export function createRateLimiter(limit: number, windowMs: number) {
  const limiterMap = new Map<string, { count: number; resetAt: number }>();
  return function (key: string, now: number): { allowed: boolean; retryAfterSeconds: number } {
    if (limiterMap.size > 1000) {
      limiterMap.forEach((val, k) => {
        if (now > val.resetAt) {
          limiterMap.delete(k);
        }
      });
    }

    let entry = limiterMap.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
    }
    entry.count++;
    limiterMap.set(key, entry);

    const allowed = entry.count <= limit;
    const retryAfterSeconds = allowed ? 0 : Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return { allowed, retryAfterSeconds };
  };
}
