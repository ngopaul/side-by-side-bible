import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { getBook } from "../canon";
import { BibleProviderError } from "../provider";
import type {
  BibleProvider,
  BibleProviderRequest,
  ManuscriptOmissionAnnotation,
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
    profile: {
      approach: "Source text · Biblical Hebrew",
      publication: "WLC transcription · OSHB morphology v2.0",
      description:
        "The public-domain Westminster Leningrad Codex with Open Scriptures lemma and morphology data.",
      infoLinks: [
        {
          label: "Open Scriptures Hebrew Bible",
          url: "https://github.com/openscriptures/morphhb",
        },
      ],
    },
  },
  greek: {
    id: "original",
    abbreviation: "OGNT",
    name: "Open Greek New Testament",
    language: "Greek",
    provider: "original",
    availability: ["new"],
    direction: "ltr",
    profile: {
      approach: "Source text · Koine Greek",
      publication: "OGNT v3 · 2018",
      description:
        "A freely licensed Greek New Testament compiled as a close, NA-equivalent text for study and resource alignment.",
      infoLinks: [
        {
          label: "Open Greek New Testament",
          url: "https://github.com/eliranwong/OpenGNT",
        },
        {
          label: "Scrivener 1894 Textus Receptus alternates",
          url: "https://github.com/byztxt/greektext-scrivener",
        },
      ],
    },
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
    const originalSourceOmissions: Record<
      number,
      ManuscriptOmissionAnnotation
    > = {};
    for (const { verse, ...annotation } of chapter.omissions ?? []) {
      originalSourceOmissions[verse] = annotation;
    }
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
        ...(Object.keys(originalSourceOmissions).length > 0
          ? { originalSourceOmissions }
          : {}),
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
      !Array.isArray(value.verses) ||
      (value.omissions !== undefined && !Array.isArray(value.omissions))
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
