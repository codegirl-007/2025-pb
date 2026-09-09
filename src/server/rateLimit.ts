export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  allow(key: string, limit: number, windowMs: number): boolean {
    const t = this.now();
    const existing = this.hits.get(key) ?? [];
    const recent = existing.filter((stamp) => t - stamp < windowMs);
    if (recent.length >= limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(t);
    this.hits.set(key, recent);
    return true;
  }
}
