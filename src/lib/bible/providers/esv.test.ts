import { afterEach, describe, expect, it, vi } from "vitest";

import fixture from "../__fixtures__/esv.json";
import { EsvProvider, formatEsvChapterQuery } from "./esv";

describe("ESV chapter queries", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["OBA", "Obadiah"],
    ["PHM", "Philemon"],
    ["2JN", "2 John"],
    ["3JN", "3 John"],
    ["JUD", "Jude"],
  ] as const)("omits chapter for %s", (book, query) => {
    expect(formatEsvChapterQuery({ book, chapter: 1 })).toBe(query);
  });

  it.each([
    [{ book: "GEN", chapter: 1 } as const, "Genesis 1"],
    [{ book: "JHN", chapter: 3 } as const, "John 3"],
  ])("keeps chapter for multi-chapter books", (reference, query) => {
    expect(formatEsvChapterQuery(reference)).toBe(query);
  });

  it("requests the full copyright notice", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(fixture),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new EsvProvider({
      token: "server-token",
      baseUrl: "https://esv.invalid/passage/html/",
    });

    await provider.getChapter({
      reference: { book: "GEN", chapter: 1 },
      translations: ["esv"],
    });

    const [input] = fetchMock.mock.calls[0];
    const url = new URL(input.toString());
    expect(url.searchParams.get("include-short-copyright")).toBe("false");
    expect(url.searchParams.get("include-copyright")).toBe("true");
  });
});
