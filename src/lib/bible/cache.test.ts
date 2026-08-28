import { describe, expect, it } from "vitest";

import { ExpiringWeightCache } from "./cache";

describe("ExpiringWeightCache", () => {
  it("expires entries at their TTL", () => {
    let now = 1_000;
    const cache = new ExpiringWeightCache<string>(500, 100, () => now);
    cache.set("chapter", "value", 31);

    expect(cache.get("chapter")).toBe("value");
    now = 1_100;
    expect(cache.get("chapter")).toBeUndefined();
    expect(cache.weight).toBe(0);
  });

  it("never exceeds its weighted LRU limit", () => {
    const cache = new ExpiringWeightCache<string>(500, 1_000);
    cache.set("oldest", "a", 300);
    cache.set("newest", "b", 250);

    expect(cache.get("oldest")).toBeUndefined();
    expect(cache.get("newest")).toBe("b");
    expect(cache.weight).toBe(250);
    cache.set("oversized", "c", 501);
    expect(cache.get("oversized")).toBeUndefined();
  });
});
