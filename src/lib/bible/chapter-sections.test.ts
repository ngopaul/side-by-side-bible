import { describe, expect, it } from "vitest";

import {
  chapterSectionRanges,
  resolveChapterPart,
  sliceChapterRows,
} from "./chapter-sections";
import type { ChapterCell, ChapterRow } from "./types";

describe("chapterSectionRanges", () => {
  it("handles empty, single-row, even, and odd chapters", () => {
    expect(chapterSectionRanges(0)).toEqual([]);
    expect(chapterSectionRanges(1)).toEqual([{ start: 0, end: 1 }]);
    expect(chapterSectionRanges(2)).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: 2 },
    ]);
    expect(sectionSizes(25)).toEqual([9, 8, 8]);
    expect(sectionSizes(31)).toEqual([11, 10, 10]);
    expect(sectionSizes(32)).toEqual([16, 16]);
  });

  it("produces complete balanced ranges within the half-chapter limit", () => {
    for (let rowCount = 2; rowCount <= 100; rowCount += 1) {
      const ranges = chapterSectionRanges(rowCount);
      const sizes = ranges.map(({ start, end }) => end - start);
      expect(ranges).toHaveLength(rowCount % 2 === 0 ? 2 : 3);
      expect(ranges[0].start).toBe(0);
      expect(ranges.at(-1)?.end).toBe(rowCount);
      expect(
        ranges.every((range, index) =>
          index === 0 ? true : range.start === ranges[index - 1].end,
        ),
      ).toBe(true);
      expect(Math.max(...sizes)).toBeLessThanOrEqual(Math.floor(rowCount / 2));
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });

  it("moves balanced boundaries to avoid splitting merged cells", () => {
    const rows = chapterRows(7);
    rows[2].cells.esv = [mergedCell(true)];
    rows[3].cells.esv = [mergedCell(false)];

    expect(chapterSectionRanges(rows)).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 5 },
      { start: 5, end: 7 },
    ]);
  });
});

describe("resolveChapterPart", () => {
  it("defaults missing values and canonicalizes invalid or out-of-range values", () => {
    expect(resolveChapterPart(null, 3)).toEqual({
      part: 1,
      canonicalize: false,
    });
    expect(resolveChapterPart("2", 3)).toEqual({
      part: 2,
      canonicalize: false,
    });
    expect(resolveChapterPart("0", 3)).toEqual({
      part: 1,
      canonicalize: true,
    });
    expect(resolveChapterPart("2.5", 3)).toEqual({
      part: 1,
      canonicalize: true,
    });
    expect(resolveChapterPart("9", 3)).toEqual({
      part: 3,
      canonicalize: true,
    });
  });
});

describe("sliceChapterRows", () => {
  it("clamps a starter and replaces a continuation with a placeholder", () => {
    const rows = chapterRows(6);
    rows[2].cells.esv = [mergedCell(true)];
    rows[3].cells.esv = [mergedCell(false)];
    const ranges = chapterSectionRanges(rows);

    expect(ranges).toEqual([
      { start: 0, end: 3 },
      { start: 3, end: 6 },
    ]);
    expect(sliceChapterRows(rows, ranges[0])[2].cells.esv?.[0]).toMatchObject({
      display: true,
      rowSpan: 1,
    });
    expect(sliceChapterRows(rows, ranges[1])[0].cells.esv?.[0]).toMatchObject({
      continuation: true,
      display: true,
      rowSpan: 1,
      text: "",
    });
    expect(rows[2].cells.esv?.[0].rowSpan).toBe(2);
    expect(rows[3].cells.esv?.[0].display).toBe(false);
  });
});

function sectionSizes(rowCount: number): number[] {
  return chapterSectionRanges(rowCount).map(({ start, end }) => end - start);
}

function chapterRows(rowCount: number): ChapterRow[] {
  return Array.from({ length: rowCount }, (_, index) => {
    const verse = index + 1;
    return {
      verse,
      cells: {
        esv: [
          {
            translation: "esv",
            text: `Verse ${verse}`,
            sourceReferences: [],
            canonicalSlots: [{ book: "JHN", chapter: 1, verse }],
            display: true,
            rowSpan: 1,
          },
        ],
      },
    };
  });
}

function mergedCell(display: boolean): ChapterCell {
  return {
    translation: "esv",
    text: "Merged verses 3–4",
    sourceReferences: [],
    canonicalSlots: [
      { book: "JHN", chapter: 1, verse: 3 },
      { book: "JHN", chapter: 1, verse: 4 },
    ],
    display,
    rowSpan: 2,
  };
}
