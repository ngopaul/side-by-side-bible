import {
  MAX_SELECTED_VERSIONS,
  TRANSLATIONS,
  getBook,
  getTranslation,
  isBookId,
  isValidChapter,
  normalizeTranslationIds,
} from "./canon";
import { createFumsReport } from "./fums";
import { providerError } from "./provider";
import type {
  BibleError,
  BibleProvider,
  BookId,
  ChapterCell,
  ChapterMatrix,
  ChapterReference,
  ChapterRow,
  ChapterVersion,
  NormalizedChapter,
  NormalizedVerse,
  TranslationId,
  TranslationProvider,
} from "./types";

interface ChapterServiceRequest {
  book: string;
  chapter: number;
  translations: readonly string[];
}

export class BibleRequestError extends Error {
  constructor(
    message: string,
    readonly field: "book" | "chapter" | "versions",
  ) {
    super(message);
    this.name = "BibleRequestError";
  }
}

export class BibleService {
  private readonly providers: ReadonlyMap<TranslationProvider, BibleProvider>;

  constructor(
    providers: readonly BibleProvider[],
    private readonly fumsSecret?: string,
  ) {
    this.providers = new Map(
      providers.map((provider) => [provider.id, provider]),
    );
  }

  async getChapter(request: ChapterServiceRequest): Promise<ChapterMatrix> {
    const validated = validateRequest(request);
    const groups = new Map<TranslationProvider, TranslationId[]>();
    const versionErrors = new Map<TranslationId, BibleError>();

    for (const translation of validated.translations) {
      const metadata = getTranslation(translation);
      if (!metadata.availability.includes(getBook(validated.reference.book).testament)) {
        versionErrors.set(translation, {
          code: "translation-unavailable",
          message: `${metadata.abbreviation} is unavailable for this testament`,
          provider: metadata.provider,
          retryable: false,
        });
        continue;
      }
      groups.set(metadata.provider, [
        ...(groups.get(metadata.provider) ?? []),
        translation,
      ]);
    }

    const groupEntries = [...groups.entries()];
    const settled = await Promise.allSettled(
      groupEntries.map(([providerId, translations]) => {
        const provider = this.providers.get(providerId);
        if (!provider) {
          throw new Error(`${providerId} provider is not configured`);
        }
        return provider.getChapter({
          reference: validated.reference,
          translations,
        });
      }),
    );

    const chapters = new Map<TranslationId, NormalizedChapter>();
    settled.forEach((result, index) => {
      const [providerId, translations] = groupEntries[index];
      if (result.status === "rejected") {
        const error = providerError(result.reason, providerId);
        for (const translation of translations) {
          versionErrors.set(translation, error);
        }
        return;
      }
      for (const chapter of result.value) {
        if (translations.includes(chapter.translation)) {
          chapters.set(chapter.translation, chapter);
        }
      }
      for (const translation of translations) {
        if (!chapters.has(translation)) {
          versionErrors.set(translation, {
            code: "invalid-response",
            message: `${getTranslation(translation).abbreviation} was missing from the provider response`,
            provider: providerId,
            retryable: false,
          });
        }
      }
    });

    return {
      reference: validated.reference,
      versions: validated.translations.map((translation) =>
        this.createVersion(
          translation,
          chapters.get(translation),
          versionErrors.get(translation),
        ),
      ),
      rows: alignChapters(
        validated.reference,
        validated.translations,
        chapters,
      ),
    };
  }

  private createVersion(
    translation: TranslationId,
    chapter: NormalizedChapter | undefined,
    error: BibleError | undefined,
  ): ChapterVersion {
    return {
      translation: chapter?.translationMetadata ?? getTranslation(translation),
      ...(chapter ? { attribution: chapter.attribution } : {}),
      ...(error ? { error } : {}),
      ...(chapter?.fums && this.fumsSecret
        ? { fums: createFumsReport(chapter.fums, this.fumsSecret) }
        : {}),
    };
  }
}

export function alignChapters(
  reference: ChapterReference,
  translations: readonly TranslationId[],
  chapters: ReadonlyMap<TranslationId, NormalizedChapter>,
): ChapterRow[] {
  const verseNumbers = new Set<number>();
  for (const chapter of chapters.values()) {
    for (const verse of chapter.verses) {
      for (const slot of relevantSlots(verse, reference)) {
        verseNumbers.add(slot.verse);
      }
    }
  }

  return [...verseNumbers]
    .sort((left, right) => left - right)
    .map((verseNumber) => {
      const cells: ChapterRow["cells"] = {};
      for (const translation of translations) {
        const chapter = chapters.get(translation);
        if (!chapter) {
          continue;
        }
        const matching = chapter.verses
          .filter((verse) =>
            relevantSlots(verse, reference).some(
              (slot) => slot.verse === verseNumber,
            ),
          )
          .map((verse) => createCell(translation, verse, reference, verseNumber));
        if (matching.length > 0) {
          cells[translation] = matching;
        }
      }
      const original = translations.includes("original")
        ? chapters.get("original")
        : undefined;
      const annotation = original?.originalSourceOmissions?.[verseNumber];
      const originalHasText = cells.original?.some((cell) => cell.text.trim());
      const translationHasText = Object.entries(cells).some(
        ([translation, chapterCells]) =>
          translation !== "original" &&
          chapterCells.some((cell) => cell.text.trim()),
      );
      const annotations: ChapterRow["annotations"] = {};
      if (annotation && !originalHasText && translationHasText) {
        annotations.original = annotation;
        for (const [translation, chapterCells] of Object.entries(cells)) {
          if (
            translation !== "original" &&
            chapterCells.some((cell) => cell.text.trim())
          ) {
            annotations[translation as TranslationId] = annotation;
          }
        }
      }
      return {
        verse: verseNumber,
        cells,
        ...(Object.keys(annotations).length > 0
          ? { annotations }
          : {}),
      };
    });
}

function createCell(
  translation: TranslationId,
  verse: NormalizedVerse,
  reference: ChapterReference,
  rowVerse: number,
): ChapterCell {
  const slots = relevantSlots(verse, reference).sort(
    (left, right) => left.verse - right.verse,
  );
  return {
    translation,
    text: verse.text,
    ...(verse.lines ? { lines: verse.lines } : {}),
    sourceReferences: verse.sourceReferences,
    canonicalSlots: slots,
    display: slots[0]?.verse === rowVerse,
    rowSpan: contiguousSpan(slots.map((slot) => slot.verse)),
  };
}

function relevantSlots(
  verse: NormalizedVerse,
  reference: ChapterReference,
) {
  return verse.slots.filter(
    (slot) =>
      slot.book === reference.book && slot.chapter === reference.chapter,
  );
}

function contiguousSpan(verses: readonly number[]): number {
  if (verses.length === 0) {
    return 1;
  }
  let span = 1;
  while (
    span < verses.length &&
    verses[span] === verses[span - 1] + 1
  ) {
    span += 1;
  }
  return span;
}

function validateRequest(request: ChapterServiceRequest): {
  reference: ChapterReference;
  translations: TranslationId[];
} {
  const book = request.book.toUpperCase();
  if (!isBookId(book)) {
    throw new BibleRequestError("Unknown book", "book");
  }
  const reference = { book, chapter: request.chapter };
  if (!isValidChapter(reference)) {
    throw new BibleRequestError("Chapter is outside the canonical range", "chapter");
  }
  if (request.translations.length === 0) {
    throw new BibleRequestError(
      `Select between one and ${MAX_SELECTED_VERSIONS} versions`,
      "versions",
    );
  }
  const known = new Set<string>(TRANSLATIONS.map(({ id }) => id));
  const migrated = request.translations.map((translation) => {
    const normalized = translation.toLowerCase();
    return normalized === "hebrew" || normalized === "greek"
      ? "original"
      : normalized;
  });
  if (migrated.some((translation) => !known.has(translation))) {
    throw new BibleRequestError("Unknown version", "versions");
  }
  const translations = normalizeTranslationIds(request.translations);
  if (!translations) {
    throw new BibleRequestError(
      `Select between one and ${MAX_SELECTED_VERSIONS} versions`,
      "versions",
    );
  }
  return {
    reference: reference as { book: BookId; chapter: number },
    translations,
  };
}
