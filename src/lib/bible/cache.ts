interface CacheEntry<T> {
  value: T;
  weight: number;
  expiresAt: number;
}

export class ExpiringWeightCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private totalWeight = 0;

  constructor(
    private readonly maxWeight: number,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= this.now()) {
      this.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, weight: number): void {
    if (!Number.isInteger(weight) || weight < 0) {
      throw new RangeError("Cache weight must be a non-negative integer");
    }
    this.pruneExpired();
    this.delete(key);
    if (weight > this.maxWeight) {
      return;
    }
    this.entries.set(key, {
      value,
      weight,
      expiresAt: this.now() + this.ttlMs,
    });
    this.totalWeight += weight;
    while (this.totalWeight > this.maxWeight) {
      const oldestKey = this.entries.keys().next().value;
      if (typeof oldestKey !== "string") {
        break;
      }
      this.delete(oldestKey);
    }
  }

  get weight(): number {
    this.pruneExpired();
    return this.totalWeight;
  }

  get size(): number {
    this.pruneExpired();
    return this.entries.size;
  }

  private pruneExpired(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.delete(key);
      }
    }
  }

  private delete(key: string): void {
    const entry = this.entries.get(key);
    if (entry) {
      this.totalWeight -= entry.weight;
      this.entries.delete(key);
    }
  }
}
