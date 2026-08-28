import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("chapter route validation", () => {
  it("migrates a legacy ID and returns resolved original metadata", async () => {
    const response = await GET(
      new Request(
        "https://app.invalid/api/bible/chapter?book=GEN&chapter=1&versions=hebrew",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body).toMatchObject({
      reference: { book: "GEN", chapter: 1 },
      versions: [
        {
          translation: {
            id: "original",
            abbreviation: "OSHB",
            language: "Hebrew",
            direction: "rtl",
          },
        },
      ],
    });
    expect(body.rows).toHaveLength(31);
  });

  it.each([
    "https://app.invalid/api/bible/chapter?book=BAD&chapter=1&versions=esv",
    "https://app.invalid/api/bible/chapter?book=GEN&chapter=nope&versions=esv",
    "https://app.invalid/api/bible/chapter?book=GEN&chapter=1&versions=unknown",
    "https://app.invalid/api/bible/chapter?book=GEN&chapter=1&versions=esv,nasb,niv,nkjv,rcv,hebrew",
  ])("returns a no-store 400 for %s", async (url) => {
    const response = await GET(new Request(url));

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid-request" },
    });
  });
});
