import type {
  BibleBook,
  BookId,
  ChapterReference,
  TranslationId,
  TranslationMetadata,
} from "./types";

export const BIBLE_BOOKS = [
  { id: "GEN", osisId: "Gen", apiBibleId: "GEN", name: "Genesis", testament: "old", chapters: 50 },
  { id: "EXO", osisId: "Exod", apiBibleId: "EXO", name: "Exodus", testament: "old", chapters: 40 },
  { id: "LEV", osisId: "Lev", apiBibleId: "LEV", name: "Leviticus", testament: "old", chapters: 27 },
  { id: "NUM", osisId: "Num", apiBibleId: "NUM", name: "Numbers", testament: "old", chapters: 36 },
  { id: "DEU", osisId: "Deut", apiBibleId: "DEU", name: "Deuteronomy", testament: "old", chapters: 34 },
  { id: "JOS", osisId: "Josh", apiBibleId: "JOS", name: "Joshua", testament: "old", chapters: 24 },
  { id: "JDG", osisId: "Judg", apiBibleId: "JDG", name: "Judges", testament: "old", chapters: 21 },
  { id: "RUT", osisId: "Ruth", apiBibleId: "RUT", name: "Ruth", testament: "old", chapters: 4 },
  { id: "1SA", osisId: "1Sam", apiBibleId: "1SA", name: "1 Samuel", testament: "old", chapters: 31 },
  { id: "2SA", osisId: "2Sam", apiBibleId: "2SA", name: "2 Samuel", testament: "old", chapters: 24 },
  { id: "1KI", osisId: "1Kgs", apiBibleId: "1KI", name: "1 Kings", testament: "old", chapters: 22 },
  { id: "2KI", osisId: "2Kgs", apiBibleId: "2KI", name: "2 Kings", testament: "old", chapters: 25 },
  { id: "1CH", osisId: "1Chr", apiBibleId: "1CH", name: "1 Chronicles", testament: "old", chapters: 29 },
  { id: "2CH", osisId: "2Chr", apiBibleId: "2CH", name: "2 Chronicles", testament: "old", chapters: 36 },
  { id: "EZR", osisId: "Ezra", apiBibleId: "EZR", name: "Ezra", testament: "old", chapters: 10 },
  { id: "NEH", osisId: "Neh", apiBibleId: "NEH", name: "Nehemiah", testament: "old", chapters: 13 },
  { id: "EST", osisId: "Esth", apiBibleId: "EST", name: "Esther", testament: "old", chapters: 10 },
  { id: "JOB", osisId: "Job", apiBibleId: "JOB", name: "Job", testament: "old", chapters: 42 },
  { id: "PSA", osisId: "Ps", apiBibleId: "PSA", name: "Psalms", testament: "old", chapters: 150 },
  { id: "PRO", osisId: "Prov", apiBibleId: "PRO", name: "Proverbs", testament: "old", chapters: 31 },
  { id: "ECC", osisId: "Eccl", apiBibleId: "ECC", name: "Ecclesiastes", testament: "old", chapters: 12 },
  { id: "SNG", osisId: "Song", apiBibleId: "SNG", name: "Song of Solomon", testament: "old", chapters: 8 },
  { id: "ISA", osisId: "Isa", apiBibleId: "ISA", name: "Isaiah", testament: "old", chapters: 66 },
  { id: "JER", osisId: "Jer", apiBibleId: "JER", name: "Jeremiah", testament: "old", chapters: 52 },
  { id: "LAM", osisId: "Lam", apiBibleId: "LAM", name: "Lamentations", testament: "old", chapters: 5 },
  { id: "EZK", osisId: "Ezek", apiBibleId: "EZK", name: "Ezekiel", testament: "old", chapters: 48 },
  { id: "DAN", osisId: "Dan", apiBibleId: "DAN", name: "Daniel", testament: "old", chapters: 12 },
  { id: "HOS", osisId: "Hos", apiBibleId: "HOS", name: "Hosea", testament: "old", chapters: 14 },
  { id: "JOL", osisId: "Joel", apiBibleId: "JOL", name: "Joel", testament: "old", chapters: 3 },
  { id: "AMO", osisId: "Amos", apiBibleId: "AMO", name: "Amos", testament: "old", chapters: 9 },
  { id: "OBA", osisId: "Obad", apiBibleId: "OBA", name: "Obadiah", testament: "old", chapters: 1 },
  { id: "JON", osisId: "Jonah", apiBibleId: "JON", name: "Jonah", testament: "old", chapters: 4 },
  { id: "MIC", osisId: "Mic", apiBibleId: "MIC", name: "Micah", testament: "old", chapters: 7 },
  { id: "NAM", osisId: "Nah", apiBibleId: "NAM", name: "Nahum", testament: "old", chapters: 3 },
  { id: "HAB", osisId: "Hab", apiBibleId: "HAB", name: "Habakkuk", testament: "old", chapters: 3 },
  { id: "ZEP", osisId: "Zeph", apiBibleId: "ZEP", name: "Zephaniah", testament: "old", chapters: 3 },
  { id: "HAG", osisId: "Hag", apiBibleId: "HAG", name: "Haggai", testament: "old", chapters: 2 },
  { id: "ZEC", osisId: "Zech", apiBibleId: "ZEC", name: "Zechariah", testament: "old", chapters: 14 },
  { id: "MAL", osisId: "Mal", apiBibleId: "MAL", name: "Malachi", testament: "old", chapters: 4 },
  { id: "MAT", osisId: "Matt", apiBibleId: "MAT", name: "Matthew", testament: "new", chapters: 28 },
  { id: "MRK", osisId: "Mark", apiBibleId: "MRK", name: "Mark", testament: "new", chapters: 16 },
  { id: "LUK", osisId: "Luke", apiBibleId: "LUK", name: "Luke", testament: "new", chapters: 24 },
  { id: "JHN", osisId: "John", apiBibleId: "JHN", name: "John", testament: "new", chapters: 21 },
  { id: "ACT", osisId: "Acts", apiBibleId: "ACT", name: "Acts", testament: "new", chapters: 28 },
  { id: "ROM", osisId: "Rom", apiBibleId: "ROM", name: "Romans", testament: "new", chapters: 16 },
  { id: "1CO", osisId: "1Cor", apiBibleId: "1CO", name: "1 Corinthians", testament: "new", chapters: 16 },
  { id: "2CO", osisId: "2Cor", apiBibleId: "2CO", name: "2 Corinthians", testament: "new", chapters: 13 },
  { id: "GAL", osisId: "Gal", apiBibleId: "GAL", name: "Galatians", testament: "new", chapters: 6 },
  { id: "EPH", osisId: "Eph", apiBibleId: "EPH", name: "Ephesians", testament: "new", chapters: 6 },
  { id: "PHP", osisId: "Phil", apiBibleId: "PHP", name: "Philippians", testament: "new", chapters: 4 },
  { id: "COL", osisId: "Col", apiBibleId: "COL", name: "Colossians", testament: "new", chapters: 4 },
  { id: "1TH", osisId: "1Thess", apiBibleId: "1TH", name: "1 Thessalonians", testament: "new", chapters: 5 },
  { id: "2TH", osisId: "2Thess", apiBibleId: "2TH", name: "2 Thessalonians", testament: "new", chapters: 3 },
  { id: "1TI", osisId: "1Tim", apiBibleId: "1TI", name: "1 Timothy", testament: "new", chapters: 6 },
  { id: "2TI", osisId: "2Tim", apiBibleId: "2TI", name: "2 Timothy", testament: "new", chapters: 4 },
  { id: "TIT", osisId: "Titus", apiBibleId: "TIT", name: "Titus", testament: "new", chapters: 3 },
  { id: "PHM", osisId: "Phlm", apiBibleId: "PHM", name: "Philemon", testament: "new", chapters: 1 },
  { id: "HEB", osisId: "Heb", apiBibleId: "HEB", name: "Hebrews", testament: "new", chapters: 13 },
  { id: "JAS", osisId: "Jas", apiBibleId: "JAS", name: "James", testament: "new", chapters: 5 },
  { id: "1PE", osisId: "1Pet", apiBibleId: "1PE", name: "1 Peter", testament: "new", chapters: 5 },
  { id: "2PE", osisId: "2Pet", apiBibleId: "2PE", name: "2 Peter", testament: "new", chapters: 3 },
  { id: "1JN", osisId: "1John", apiBibleId: "1JN", name: "1 John", testament: "new", chapters: 5 },
  { id: "2JN", osisId: "2John", apiBibleId: "2JN", name: "2 John", testament: "new", chapters: 1 },
  { id: "3JN", osisId: "3John", apiBibleId: "3JN", name: "3 John", testament: "new", chapters: 1 },
  { id: "JUD", osisId: "Jude", apiBibleId: "JUD", name: "Jude", testament: "new", chapters: 1 },
  { id: "REV", osisId: "Rev", apiBibleId: "REV", name: "Revelation", testament: "new", chapters: 22 },
] as const satisfies readonly BibleBook[];

export const MAX_SELECTED_VERSIONS = 5;

export const TRANSLATIONS = [
  { id: "nasb", abbreviation: "NASB", name: "New American Standard Bible", language: "English", provider: "api-bible", availability: ["old", "new"], direction: "ltr" },
  { id: "nkjv", abbreviation: "NKJV", name: "New King James Version", language: "English", provider: "api-bible", availability: ["old", "new"], direction: "ltr" },
  { id: "niv", abbreviation: "NIV", name: "New International Version", language: "English", provider: "api-bible", availability: ["old", "new"], direction: "ltr" },
  { id: "rcv", abbreviation: "RcV", name: "Recovery Version", language: "English", provider: "lsm", availability: ["old", "new"], direction: "ltr" },
  { id: "esv", abbreviation: "ESV", name: "English Standard Version", language: "English", provider: "esv", availability: ["old", "new"], direction: "ltr" },
  { id: "original", abbreviation: "Original", name: "Original Languages", language: "Original", provider: "original", availability: ["old", "new"], direction: "ltr" },
] as const satisfies readonly TranslationMetadata[];

const booksById = new Map<BookId, BibleBook>(
  BIBLE_BOOKS.map((book) => [book.id, book]),
);

const booksByOsisId = new Map<string, BibleBook>(
  BIBLE_BOOKS.map((book) => [book.osisId, book]),
);

const translationsById = new Map<TranslationId, TranslationMetadata>(
  TRANSLATIONS.map((translation) => [translation.id, translation]),
);

export function isBookId(value: string): value is BookId {
  return booksById.has(value as BookId);
}

export function getBook(id: BookId): BibleBook {
  const book = booksById.get(id);
  if (!book) {
    throw new RangeError(`Unknown book: ${id}`);
  }
  return book;
}

export function getBookByOsisId(osisId: string): BibleBook | undefined {
  return booksByOsisId.get(osisId);
}

export function getTranslation(id: TranslationId): TranslationMetadata {
  const translation = translationsById.get(id);
  if (!translation) {
    throw new RangeError(`Unknown translation: ${id}`);
  }
  return translation;
}

export function normalizeTranslationIds(
  values: readonly string[],
): TranslationId[] | undefined {
  const normalized: TranslationId[] = [];
  for (const value of values) {
    const candidate = value.toLowerCase();
    const migrated = candidate === "hebrew" || candidate === "greek"
      ? "original"
      : candidate;
    if (!translationsById.has(migrated as TranslationId)) {
      return undefined;
    }
    const translation = migrated as TranslationId;
    if (!normalized.includes(translation)) {
      normalized.push(translation);
    }
  }
  return normalized.length >= 1 && normalized.length <= MAX_SELECTED_VERSIONS
    ? normalized
    : undefined;
}

export function isValidChapter(reference: ChapterReference): boolean {
  return (
    Number.isInteger(reference.chapter) &&
    reference.chapter >= 1 &&
    reference.chapter <= getBook(reference.book).chapters
  );
}

export function getPreviousChapter(
  reference: ChapterReference,
): ChapterReference | null {
  if (!isValidChapter(reference)) {
    throw new RangeError("Invalid chapter reference");
  }
  if (reference.chapter > 1) {
    return { book: reference.book, chapter: reference.chapter - 1 };
  }
  const bookIndex = BIBLE_BOOKS.findIndex((book) => book.id === reference.book);
  if (bookIndex === 0) {
    return null;
  }
  const previousBook = BIBLE_BOOKS[bookIndex - 1];
  return { book: previousBook.id, chapter: previousBook.chapters };
}

export function getNextChapter(
  reference: ChapterReference,
): ChapterReference | null {
  if (!isValidChapter(reference)) {
    throw new RangeError("Invalid chapter reference");
  }
  const book = getBook(reference.book);
  if (reference.chapter < book.chapters) {
    return { book: reference.book, chapter: reference.chapter + 1 };
  }
  const bookIndex = BIBLE_BOOKS.findIndex((entry) => entry.id === reference.book);
  const nextBook = BIBLE_BOOKS[bookIndex + 1];
  return nextBook ? { book: nextBook.id, chapter: 1 } : null;
}
