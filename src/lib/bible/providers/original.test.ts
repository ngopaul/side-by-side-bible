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
});
