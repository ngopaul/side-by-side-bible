import { describe, expect, it } from "vitest";

import {
  BIBLE_BOOKS,
  MAX_SELECTED_VERSIONS,
  TRANSLATIONS,
  getNextChapter,
  getPreviousChapter,
  normalizeTranslationIds,
} from "./canon";

describe("Bible canon", () => {
  it("contains all canonical books in order with unique identifiers", () => {
    expect(BIBLE_BOOKS).toHaveLength(66);
    expect(BIBLE_BOOKS.map((book) => book.chapters)).toEqual([
      50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10,
      42, 150, 31, 12, 8, 66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2,
      14, 4, 28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1,
      13, 5, 5, 3, 5, 1, 1, 1, 22,
    ]);
    expect(BIBLE_BOOKS[0]).toMatchObject({
      id: "GEN",
      osisId: "Gen",
      apiBibleId: "GEN",
      chapters: 50,
    });
    expect(BIBLE_BOOKS[65]).toMatchObject({
      id: "REV",
      osisId: "Rev",
      apiBibleId: "REV",
      chapters: 22,
    });
    expect(new Set(BIBLE_BOOKS.map((book) => book.id)).size).toBe(66);
    expect(new Set(BIBLE_BOOKS.map((book) => book.osisId)).size).toBe(66);
  });

  it("navigates within and across books and canon boundaries", () => {
    expect(getPreviousChapter({ book: "GEN", chapter: 1 })).toBeNull();
    expect(getNextChapter({ book: "GEN", chapter: 1 })).toEqual({
      book: "GEN",
      chapter: 2,
    });
    expect(getNextChapter({ book: "MAL", chapter: 4 })).toEqual({
      book: "MAT",
      chapter: 1,
    });
    expect(getPreviousChapter({ book: "MAT", chapter: 1 })).toEqual({
      book: "MAL",
      chapter: 4,
    });
    expect(getNextChapter({ book: "REV", chapter: 22 })).toBeNull();
  });

  it("defines translation scope and selection limit", () => {
    expect(TRANSLATIONS.map((translation) => translation.id)).toEqual([
      "nasb",
      "nkjv",
      "niv",
      "rcv",
      "esv",
      "original",
    ]);
    expect(TRANSLATIONS.find(({ id }) => id === "original")).toMatchObject({
      abbreviation: "Original",
      availability: ["old", "new"],
    });
    expect(MAX_SELECTED_VERSIONS).toBe(5);
  });

  it("migrates and deduplicates legacy original-language IDs", () => {
    expect(
      normalizeTranslationIds([
        "ESV",
        "hebrew",
        "original",
        "greek",
        "nasb",
      ]),
    ).toEqual(["esv", "original", "nasb"]);
  });
});
