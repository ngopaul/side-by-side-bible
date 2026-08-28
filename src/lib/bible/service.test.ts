import { describe, expect, it, vi } from "vitest";

import { verifyFumsReportToken } from "./fums";
import { BibleService } from "./service";
import type {
  BibleProvider,
  NormalizedChapter,
  NormalizedVerse,
  TranslationId,
  TranslationProvider,
} from "./types";

const reference = { book: "GEN", chapter: 1 } as const;

describe("BibleService", () => {
  it("groups translations and aligns merged and split mappings", async () => {
    const apiChapter = chapter("nasb", [
      verse([1, 2], "merged"),
      verse([3], "split a", 31),
      verse([3], "split b", 32),
    ]);
    apiChapter.fums = {
      fumsId: "display-id",
      fums: "https://fums.api.bible/f3/display-id",
    };
    const apiProvider = mockProvider("api-bible", [apiChapter, chapter("niv")]);
    const esvProvider = mockProvider("esv", [chapter("esv")]);
    const service = new BibleService(
      [apiProvider.provider, esvProvider.provider],
      "signing secret",
    );

    const result = await service.getChapter({
      book: "gen",
      chapter: 1,
      translations: ["nasb", "niv", "esv"],
    });

    expect(apiProvider.getChapter).toHaveBeenCalledOnce();
    expect(apiProvider.getChapter).toHaveBeenCalledWith({
      reference,
      translations: ["nasb", "niv"],
    });
    expect(result.rows.map(({ verse: number }) => number)).toEqual([1, 2, 3]);
    expect(result.rows[0].cells.nasb?.[0]).toMatchObject({
      text: "merged",
      display: true,
      rowSpan: 2,
    });
    expect(result.rows[1].cells.nasb?.[0].display).toBe(false);
    expect(result.rows[2].cells.nasb).toHaveLength(2);
    const report = result.versions[0].fums;
    expect(report?.fumsId).toBe("display-id");
    expect(report?.endpoint).toBe("/api/bible/fums");
    expect(
      verifyFumsReportToken(report?.token ?? "", "signing secret"),
    ).toEqual({ id: "display-id" });
  });

  it("returns successful providers when another provider fails", async () => {
    const apiProvider = mockProvider("api-bible", [chapter("nasb")]);
    const esvProvider = mockProvider("esv", new Error("ESV unavailable"));
    const service = new BibleService([
      apiProvider.provider,
      esvProvider.provider,
    ]);

    const result = await service.getChapter({
      book: "GEN",
      chapter: 1,
      translations: ["nasb", "esv"],
    });

    expect(result.rows).toHaveLength(3);
    expect(result.versions[0].error).toBeUndefined();
    expect(result.versions[1].error).toMatchObject({
      code: "upstream-unavailable",
      provider: "esv",
    });
  });

  it("uses provider-resolved metadata with the stable original key", async () => {
    const originalChapter = chapter("original");
    originalChapter.translationMetadata = {
      id: "original",
      abbreviation: "OSHB",
      name: "Open Scriptures Hebrew Bible",
      language: "Hebrew",
      provider: "original",
      availability: ["old"],
      direction: "rtl",
    };
    const originalProvider = mockProvider("original", [originalChapter]);
    const service = new BibleService([originalProvider.provider]);

    const result = await service.getChapter({
      book: "GEN",
      chapter: 1,
      translations: ["hebrew", "greek", "original"],
    });

    expect(originalProvider.getChapter).toHaveBeenCalledWith({
      reference,
      translations: ["original"],
    });
    expect(result.versions).toHaveLength(1);
    expect(result.versions[0].translation).toMatchObject({
      id: "original",
      abbreviation: "OSHB",
      language: "Hebrew",
      direction: "rtl",
    });
    expect(result.rows[0].cells.original?.[0].translation).toBe("original");
  });

  it.each([
    [{ book: "BAD", chapter: 1, translations: ["esv"] }, "book"],
    [{ book: "GEN", chapter: 51, translations: ["esv"] }, "chapter"],
    [{ book: "GEN", chapter: 1, translations: ["unknown"] }, "versions"],
    [
      {
        book: "GEN",
        chapter: 1,
        translations: ["esv", "nasb", "niv", "nkjv", "rcv", "hebrew"],
      },
      "versions",
    ],
  ])("validates chapter request %#", async (request, field) => {
    const service = new BibleService([]);

    await expect(service.getChapter(request)).rejects.toMatchObject({ field });
  });
});

function mockProvider(
  id: TranslationProvider,
  result: readonly NormalizedChapter[] | Error,
): {
  provider: BibleProvider;
  getChapter: ReturnType<typeof vi.fn<BibleProvider["getChapter"]>>;
} {
  const getChapter = vi.fn<BibleProvider["getChapter"]>();
  if (result instanceof Error) {
    getChapter.mockRejectedValue(result);
  } else {
    getChapter.mockResolvedValue(result);
  }
  return { provider: { id, getChapter }, getChapter };
}

function chapter(
  translation: TranslationId,
  verses: NormalizedVerse[] = [verse([1], "one"), verse([2], "two"), verse([3], "three")],
): NormalizedChapter {
  return {
    reference,
    translation,
    verses,
    attribution: { label: translation.toUpperCase(), text: `${translation} copyright` },
  };
}

function verse(
  slots: number[],
  text: string,
  sourceVerse = slots[0],
): NormalizedVerse {
  return {
    text,
    slots: slots.map((slot) => ({ ...reference, verse: slot })),
    sourceReferences: [
      {
        source: "fixture",
        book: "GEN",
        chapter: 1,
        verse: sourceVerse,
      },
    ],
  };
}
