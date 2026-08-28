import { afterEach, describe, expect, it, vi } from "vitest";

import fixture from "../__fixtures__/api-bible.json";
import { ApiBibleProvider } from "./api-bible";

describe("ApiBibleProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses one parallels request and preserves cached FUMS metadata", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(fixture),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new ApiBibleProvider({
      apiKey: "server-key",
      baseUrl: "https://api-bible.invalid/v1",
      bibleIds: { nasb: "nasb-id", niv: "niv-id" },
    });
    const request = {
      reference: { book: "GEN", chapter: 1 } as const,
      translations: ["nasb", "niv"] as const,
    };

    const first = await provider.getChapter(request);
    const cached = await provider.getChapter(request);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [input, init] = fetchMock.mock.calls[0];
    const url = new URL(input.toString());
    expect(url.pathname).toContain("/bibles/nasb-id/chapters/GEN.1");
    expect(url.searchParams.get("parallels")).toBe("niv-id");
    expect(url.searchParams.get("content-type")).toBe("json");
    expect(url.searchParams.get("include-verse-spans")).toBe("true");
    expect(url.searchParams.get("include-notes")).toBe("false");
    expect(url.searchParams.get("include-titles")).toBe("false");
    expect(url.searchParams.get("include-chapter-numbers")).toBe("false");
    expect(url.searchParams.get("include-verse-numbers")).toBe("true");
    expect(url.searchParams.get("fums-version")).toBe("3");
    expect(init?.cache).toBe("no-store");
    expect(first.map(({ fums }) => fums)).toEqual(
      cached.map(({ fums }) => fums),
    );
  });

  it("uses the Bible IDs confirmed for the configured account by default", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(fixture),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("API_BIBLE_KEY", "server-key");
    vi.stubEnv("API_BIBLE_NASB_ID", "");

    const provider = ApiBibleProvider.fromEnvironment();
    await provider.getChapter({
      reference: { book: "GEN", chapter: 1 },
      translations: ["nasb"],
    });

    const [input] = fetchMock.mock.calls[0];
    expect(new URL(input.toString()).pathname).toContain(
      "/bibles/a761ca71e0b3ddcf-01/chapters/GEN.1",
    );
  });
});
