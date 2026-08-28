import { describe, expect, it } from "vitest";

import { formatEsvChapterQuery } from "./esv";

describe("ESV chapter queries", () => {
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
});
