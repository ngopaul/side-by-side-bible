import { getBook } from "../canon";
import type {
  ChapterReference,
  NormalizedChapter,
  NormalizedVerse,
  VerseReference,
} from "../types";

type UnknownRecord = Record<string, unknown>;

export interface ParsedLsmResponse {
  chapter: NormalizedChapter;
  message?: string;
}

export function parseLsmResponse(
  value: unknown,
  reference: ChapterReference,
  requested: readonly VerseReference[],
): ParsedLsmResponse {
  const root = asRecord(value);
  const verseValues = verseArray(root?.verses);
  const verses = verseValues.flatMap((entry, index) => {
    const record = asRecord(entry);
    const text = stringValue(record?.text);
    if (!text) {
      return [];
    }
    const parsed =
      parseLsmReference(stringValue(record?.ref) ?? "", reference) ??
      requested[index];
    if (
      !parsed ||
      parsed.book !== reference.book ||
      parsed.chapter !== reference.chapter
    ) {
      return [];
    }
    return [normalizedVerse(parsed, text)];
  });
  return {
    chapter: {
      reference,
      translation: "rcv",
      verses,
      attribution: {
        label: "RcV",
        text: stringValue(root?.copyright) ?? "",
      },
    },
    ...(stringValue(root?.message) ? { message: stringValue(root?.message) } : {}),
  };
}

export function parseLsmReference(
  value: string,
  expected: ChapterReference,
): VerseReference | undefined {
  const normalized = value.trim();
  const full = /(?:^|[.\s])(\d+)[.:](\d+)(?:[a-z])?$/iu.exec(normalized);
  if (full) {
    return {
      ...expected,
      chapter: Number(full[1]),
      verse: Number(full[2]),
    };
  }
  if (getBook(expected.book).chapters === 1) {
    const singleChapter = /(?:^|[.\s])(\d+)(?:[a-z])?$/iu.exec(normalized);
    if (singleChapter) {
      return { ...expected, chapter: 1, verse: Number(singleChapter[1]) };
    }
  }
  return undefined;
}

function normalizedVerse(
  reference: VerseReference,
  text: string,
): NormalizedVerse {
  return {
    slots: [reference],
    sourceReferences: [
      {
        source: "LSM RcV",
        book: reference.book,
        chapter: reference.chapter,
        verse: reference.verse,
      },
    ],
    text,
  };
}

function verseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  const record = asRecord(value);
  if (Array.isArray(record?.verse)) {
    return record.verse;
  }
  return record?.verse ? [record.verse] : [];
}

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
