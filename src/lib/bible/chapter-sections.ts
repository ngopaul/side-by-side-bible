import type {
  ChapterCell,
  ChapterRow,
  TranslationId,
} from "./types";

export interface ChapterSectionRange {
  start: number;
  end: number;
}

export interface ResolvedChapterPart {
  part: number;
  canonicalize: boolean;
}

export function chapterSectionRanges(
  rowsOrCount: readonly ChapterRow[] | number,
): ChapterSectionRange[] {
  const rowCount =
    typeof rowsOrCount === "number" ? normalizeRowCount(rowsOrCount) : rowsOrCount.length;
  const targetSizes = balancedSizes(rowCount);
  if (targetSizes.length < 2 || typeof rowsOrCount === "number") {
    return rangesFromSizes(targetSizes);
  }

  const unsafe = unsafeBoundaries(rowsOrCount);
  const candidates = balancedPermutations(targetSizes);
  const safeSizes = candidates.find((sizes) => {
    let boundary = 0;
    return sizes.slice(0, -1).every((size) => {
      boundary += size;
      return !unsafe.has(boundary);
    });
  });

  return rangesFromSizes(safeSizes ?? targetSizes);
}

export function resolveChapterPart(
  value: string | null,
  sectionCount: number,
): ResolvedChapterPart {
  if (value === null) {
    return { part: 1, canonicalize: false };
  }
  if (!/^[1-9]\d*$/u.test(value)) {
    return { part: 1, canonicalize: true };
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    return { part: 1, canonicalize: true };
  }
  const maximum = Math.max(1, Math.floor(sectionCount));
  const part = Math.min(parsed, maximum);
  return { part, canonicalize: part !== parsed };
}

export function sliceChapterRows(
  rows: readonly ChapterRow[],
  range: ChapterSectionRange,
): ChapterRow[] {
  const start = Math.max(0, Math.min(rows.length, Math.floor(range.start)));
  const end = Math.max(start, Math.min(rows.length, Math.floor(range.end)));

  return rows.slice(start, end).map((row, offset) => {
    const rowIndex = start + offset;
    const cells: ChapterRow["cells"] = {};
    for (const [translation, chapterCells] of Object.entries(row.cells)) {
      cells[translation as TranslationId] = chapterCells?.map((cell) =>
        normalizeCell(cell, rowIndex, start, end, rows),
      );
    }
    return { ...row, cells };
  });
}

function normalizeRowCount(rowCount: number): number {
  if (!Number.isFinite(rowCount)) {
    return 0;
  }
  return Math.max(0, Math.floor(rowCount));
}

function balancedSizes(rowCount: number): number[] {
  if (rowCount === 0) {
    return [];
  }
  if (rowCount === 1) {
    return [1];
  }
  const sectionCount = rowCount % 2 === 0 ? 2 : 3;
  const base = Math.floor(rowCount / sectionCount);
  const remainder = rowCount % sectionCount;
  return Array.from(
    { length: sectionCount },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

function rangesFromSizes(sizes: readonly number[]): ChapterSectionRange[] {
  let start = 0;
  return sizes.map((size) => {
    const range = { start, end: start + size };
    start = range.end;
    return range;
  });
}

function balancedPermutations(sizes: readonly number[]): number[][] {
  const result: number[][] = [];
  const visit = (remaining: readonly number[], selected: number[]) => {
    if (remaining.length === 0) {
      result.push(selected);
      return;
    }
    const used = new Set<number>();
    remaining.forEach((size, index) => {
      if (used.has(size)) {
        return;
      }
      used.add(size);
      visit(
        remaining.filter((_, remainingIndex) => remainingIndex !== index),
        [...selected, size],
      );
    });
  };
  visit(sizes, []);
  return result;
}

function unsafeBoundaries(rows: readonly ChapterRow[]): Set<number> {
  const unsafe = new Set<number>();
  rows.forEach((row, rowIndex) => {
    for (const chapterCells of Object.values(row.cells)) {
      for (const cell of chapterCells ?? []) {
        if (!cell.display) {
          continue;
        }
        const end = Math.min(rows.length, rowIndex + Math.max(1, cell.rowSpan));
        for (let boundary = rowIndex + 1; boundary < end; boundary += 1) {
          unsafe.add(boundary);
        }
      }
    }
  });
  return unsafe;
}

function normalizeCell(
  cell: ChapterCell,
  rowIndex: number,
  sectionStart: number,
  sectionEnd: number,
  rows: readonly ChapterRow[],
): ChapterCell {
  if (cell.display) {
    return {
      ...cell,
      rowSpan: Math.min(Math.max(1, cell.rowSpan), sectionEnd - rowIndex),
    };
  }
  if (rowIndex !== sectionStart) {
    return cell;
  }

  const starterVerse = cell.canonicalSlots[0]?.verse;
  const starterIndex =
    starterVerse === undefined
      ? -1
      : rows.findIndex(({ verse }) => verse === starterVerse);
  const elapsed = starterIndex >= 0 ? Math.max(0, rowIndex - starterIndex) : 0;
  const remainingSpan = Math.max(1, cell.rowSpan - elapsed);
  return {
    ...cell,
    text: "",
    display: true,
    rowSpan: Math.min(remainingSpan, sectionEnd - sectionStart),
    continuation: true,
  };
}
