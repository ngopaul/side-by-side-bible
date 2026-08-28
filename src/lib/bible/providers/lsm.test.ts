import { afterEach, describe, expect, it, vi } from "vitest";

import { formatLsmReference, LsmProvider } from "./lsm";

describe("LsmProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each([
    [{ book: "OBA", chapter: 1, verse: 1 } as const, "Obad.1"],
    [{ book: "PHM", chapter: 1, verse: 1 } as const, "Philem.1"],
    [{ book: "2JN", chapter: 1, verse: 4 } as const, "2John.4"],
    [{ book: "3JN", chapter: 1, verse: 5 } as const, "3John.5"],
    [{ book: "JUD", chapter: 1, verse: 9 } as const, "Jude.9"],
  ])("omits the chapter from single-chapter reference %s", (reference, value) => {
    expect(formatLsmReference(reference)).toBe(value);
  });

  it.each([
    [{ book: "GEN", chapter: 1, verse: 2 } as const, "Gen.1.2"],
    [{ book: "JHN", chapter: 3, verse: 16 } as const, "John.3.16"],
  ])("keeps the chapter in multi-chapter reference %s", (reference, value) => {
    expect(formatLsmReference(reference)).toBe(value);
  });

  it("chunks at 50 verses, deduplicates in flight, and never stores responses", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input.toString());
      const references = (url.searchParams.get("String") ?? "").split(",");
      return Response.json({
        verses: references.map((ref) => ({
          ref,
          text: `text ${ref}`,
        })),
        message: "",
        copyright: "LSM copyright",
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const provider = new LsmProvider({
      appId: "test-app",
      token: "test-token",
      baseUrl: "https://lsm.invalid/txo.php",
    });
    const request = {
      reference: { book: "PSA", chapter: 119 } as const,
      translations: ["rcv"] as const,
    };

    const [first, duplicate] = await Promise.all([
      provider.getChapter(request),
      provider.getChapter(request),
    ]);

    expect(first).toEqual(duplicate);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    for (const [input, init] of fetchMock.mock.calls) {
      const url = new URL(input.toString());
      expect((url.searchParams.get("String") ?? "").split(",").length).toBeLessThanOrEqual(50);
      expect(url.searchParams.get("In")).toBe("osis");
      expect(init?.cache).toBe("no-store");
    }

    await provider.getChapter(request);
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });

  it("accepts a legacy combined app ID and token", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const references = (
        new URL(input.toString()).searchParams.get("String") ?? ""
      ).split(",");
      expect(init?.headers).toMatchObject({
        Authorization: `Basic ${Buffer.from("test-app:test-token").toString("base64")}`,
      });
      return Response.json({
        verses: references.map((ref) => ({ ref, text: `text ${ref}` })),
        copyright: "LSM copyright",
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("LSM_APP_ID", "");
    vi.stubEnv("LSM_API_TOKEN", "");
    vi.stubEnv("LSM_API_KEY", "test-app:test-token");

    const provider = LsmProvider.fromEnvironment();
    const result = await provider.getChapter({
      reference: { book: "GEN", chapter: 1 },
      translations: ["rcv"],
    });

    expect(result[0].verses).toHaveLength(31);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
