import { describe, expect, it } from "vitest";

import { OriginalTextProvider } from "./original";

describe("OriginalTextProvider", () => {
  const provider = new OriginalTextProvider();

  it.each([
    [
      { book: "GEN", chapter: 1 } as const,
      {
        id: "original",
        abbreviation: "OSHB",
        name: "Open Scriptures Hebrew Bible",
        language: "Hebrew",
        direction: "rtl",
      },
    ],
    [
      { book: "JHN", chapter: 1 } as const,
      {
        id: "original",
        abbreviation: "OGNT",
        name: "Open Greek New Testament",
        language: "Greek",
        direction: "ltr",
      },
    ],
  ])("resolves original metadata for $0.book", async (reference, metadata) => {
    const [chapter] = await provider.getChapter({
      reference,
      translations: ["original"],
    });

    expect(chapter.translation).toBe("original");
    expect(chapter.translationMetadata).toMatchObject(metadata);
    expect(chapter.verses.length).toBeGreaterThan(0);
  });

  it("ignores requests without the original selection", async () => {
    await expect(
      provider.getChapter({
        reference: { book: "GEN", chapter: 1 },
        translations: ["esv"],
      }),
    ).resolves.toEqual([]);
  });

  it("propagates the Scrivener alternate for Mark 11:26", async () => {
    const [chapter] = await provider.getChapter({
      reference: { book: "MRK", chapter: 11 },
      translations: ["original"],
    });

    expect(
      chapter.verses.some((verse) =>
        verse.slots.some((slot) => slot.verse === 26),
      ),
    ).toBe(false);
    expect(chapter.originalSourceOmissions?.[26]).toMatchObject({
      type: "manuscript-omission",
      alternateText:
        "ει δε υμεις ουκ αφιετε ουδε ο πατηρ υμων ο εν τοις ουρανοις αφησει τα παραπτωματα υμων",
      language: "Greek",
      direction: "ltr",
      sourceLabel: "Scrivener 1894 Textus Receptus",
      sourceUrl: "https://github.com/byztxt/greektext-scrivener",
      license: "Public Domain",
      explanation: "Some manuscripts omit this verse.",
    });
  });

  it("propagates the Ezra alternate without labeling it as Nehemiah WLC", async () => {
    const [chapter] = await provider.getChapter({
      reference: { book: "NEH", chapter: 7 },
      translations: ["original"],
    });

    expect(chapter.originalSourceOmissions?.[68]).toMatchObject({
      alternateText:
        "סוּסֵיהֶ֕ם שְׁבַ֥ע מֵא֖וֹת שְׁלֹשִׁ֣ים וְשִׁשָּׁ֑ה פִּרְדֵיהֶ֕ם מָאתַ֖יִם אַרְבָּעִ֥ים וַחֲמִשָּֽׁה׃",
      language: "Hebrew",
      direction: "rtl",
      sourceLabel: "Hebrew supplied from Ezra 2:66; absent from WLC",
      sourceUrl: "https://github.com/openscriptures/morphhb",
      license: "CC BY 4.0",
      provenance: "Alternate Hebrew from OSHB/WLC Ezra 2:66",
    });
    expect(
      chapter.verses.some((verse) =>
        verse.slots.some((slot) => slot.verse === 68),
      ),
    ).toBe(false);
  });

  it.each([
    { book: "ACT", chapter: 19 } as const,
    { book: "2CO", chapter: 13 } as const,
  ])("does not annotate terminal versification differences for $book", async (reference) => {
    const [chapter] = await provider.getChapter({
      reference,
      translations: ["original"],
    });

    expect(chapter.originalSourceOmissions).toBeUndefined();
  });
});
