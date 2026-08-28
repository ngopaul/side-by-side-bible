import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { getBook } from "../canon";
import { BibleProviderError } from "../provider";
import type {
  BibleProvider,
  BibleProviderRequest,
  NormalizedChapter,
  OriginalTextSourceId,
  TranslationMetadata,
} from "../types";
import type { OriginalTextChapter } from "../original-texts";

const immutableChapters = new Map<string, Promise<OriginalTextChapter>>();

export const ORIGINAL_TRANSLATION_METADATA = {
  hebrew: {
    id: "original",
    abbreviation: "OSHB",
    name: "Open Scriptures Hebrew Bible",
    language: "Hebrew",
    provider: "original",
    availability: ["old"],
    direction: "rtl",
  },
  greek: {
    id: "original",
    abbreviation: "OGNT",
    name: "Open Greek New Testament",
    language: "Greek",
    provider: "original",
    availability: ["new"],
    direction: "ltr",
  },
} as const satisfies Record<OriginalTextSourceId, TranslationMetadata>;

export class OriginalTextProvider implements BibleProvider {
  readonly id = "original" as const;

  async getChapter(
    request: BibleProviderRequest,
  ): Promise<readonly NormalizedChapter[]> {
    if (!request.translations.includes("original")) {
      return [];
    }
    const source = getBook(request.reference.book).testament === "old"
      ? "hebrew"
      : "greek";
    const chapter = await readGeneratedOriginalChapter(
      source,
      request.reference.book,
      request.reference.chapter,
    );
    return [
      {
        reference: chapter.reference,
        translation: "original",
        translationMetadata: ORIGINAL_TRANSLATION_METADATA[source],
        verses: chapter.verses.map((verse) => ({
          slots: verse.mapping.canonicalSlots,
          sourceReferences: verse.mapping.sourceReferences,
          text: verse.text,
        })),
        attribution: chapter.attribution,
      },
    ];
  }
}

export async function readGeneratedOriginalChapter(
  translation: OriginalTextSourceId,
  book: BibleProviderRequest["reference"]["book"],
  chapter: number,
): Promise<OriginalTextChapter> {
  const key = `${translation}:${book}:${chapter}`;
  let pending = immutableChapters.get(key);
  if (!pending) {
    pending = readChapterFile(translation, book, chapter);
    immutableChapters.set(key, pending);
  }
  try {
    return await pending;
  } catch (error) {
    immutableChapters.delete(key);
    throw error;
  }
}

async function readChapterFile(
  translation: OriginalTextSourceId,
  book: BibleProviderRequest["reference"]["book"],
  chapter: number,
): Promise<OriginalTextChapter> {
  const filename = path.join(
    process.cwd(),
    "data",
    "original",
    translation,
    book,
    `${chapter}.json`,
  );
  try {
    const value = JSON.parse(await readFile(filename, "utf8")) as OriginalTextChapter;
    if (
      value.translation !== translation ||
      value.reference.book !== book ||
      value.reference.chapter !== chapter ||
      !Array.isArray(value.verses)
    ) {
      throw new Error("Generated chapter identity does not match its path");
    }
    return value;
  } catch (error) {
    throw new BibleProviderError(
      "invalid-response",
      error instanceof Error
        ? `Original text data is unavailable: ${error.message}`
        : "Original text data is unavailable",
      "original",
      false,
    );
  }
}
