import { readFile, readdir, rm, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { strFromU8, unzipSync } from "fflate";

import { BIBLE_BOOKS } from "../src/lib/bible/canon";
import {
  ORIGINAL_ATTRIBUTIONS,
  parseGreekTsv,
  parseHebrewBook,
  parseScrivenerBook,
  parseVerseMap,
  type OriginalTextChapter,
  type OriginalTextVerse,
  type ScrivenerVerse,
} from "../src/lib/bible/original-texts";
import type {
  ChapterReference,
  OriginalTextSourceId,
  VerseReference,
} from "../src/lib/bible/types";

const root = process.cwd();
const outputRoot = path.join(root, "data", "original");

async function buildHebrew(): Promise<OriginalTextVerse[]> {
  const wlcRoot = path.join(root, "morphhb", "wlc");
  const verseMapXml = await readFile(path.join(wlcRoot, "VerseMap.xml"), "utf8");
  const verseMap = parseVerseMap(verseMapXml);
  const books = BIBLE_BOOKS.filter((book) => book.testament === "old");
  const parsedBooks = await Promise.all(
    books.map(async (book) => {
      const xml = await readFile(path.join(wlcRoot, `${book.osisId}.xml`), "utf8");
      return parseHebrewBook(xml, verseMap);
    }),
  );
  return parsedBooks.flat();
}

async function buildGreek(): Promise<OriginalTextVerse[]> {
  const archive = new Uint8Array(
    await readFile(path.join(root, "OpenGNT", "OpenGNT_BASE_TEXT.zip")),
  );
  const files = unzipSync(archive);
  const entryName = Object.keys(files)
    .sort()
    .find((name) => /^OpenGNT[^/]*\.csv$/u.test(name));
  if (!entryName) {
    throw new Error("OpenGNT archive does not contain its base-text CSV");
  }
  return parseGreekTsv(strFromU8(files[entryName]));
}

async function buildScrivener(): Promise<ScrivenerVerse[]> {
  const directory = path.join(root, "greektext-scrivener", "textonly");
  const filenames = (await readdir(directory))
    .filter((filename) => filename.endsWith(".SCV") && filename !== "TITLES.SCV")
    .sort();
  const books = await Promise.all(
    filenames.map(async (filename) =>
      parseScrivenerBook(
        filename,
        await readFile(path.join(directory, filename), "utf8"),
      ),
    ),
  );
  return books.flat();
}

function groupChapters(
  translation: OriginalTextSourceId,
  verses: OriginalTextVerse[],
): OriginalTextChapter[] {
  const chapters = new Map<string, OriginalTextChapter>();
  for (const verse of verses) {
    const references = new Map<string, ChapterReference>();
    for (const slot of verse.mapping.canonicalSlots) {
      references.set(`${slot.book}.${slot.chapter}`, {
        book: slot.book,
        chapter: slot.chapter,
      });
    }
    for (const [key, reference] of references) {
      const chapter: OriginalTextChapter = chapters.get(key) ?? {
          translation,
          reference,
          attribution: ORIGINAL_ATTRIBUTIONS[translation],
          verses: [],
        };
      chapter.verses.push(verse);
      chapters.set(key, chapter);
    }
  }

  const bookOrder = new Map(
    BIBLE_BOOKS.map((book, index) => [book.id, index]),
  );
  return [...chapters.values()]
    .map((chapter) => ({
      ...chapter,
      verses: chapter.verses.toSorted((left, right) => {
        const leftSlot = left.mapping.canonicalSlots.find(
          (slot) =>
            slot.book === chapter.reference.book &&
            slot.chapter === chapter.reference.chapter,
        );
        const rightSlot = right.mapping.canonicalSlots.find(
          (slot) =>
            slot.book === chapter.reference.book &&
            slot.chapter === chapter.reference.chapter,
        );
        return (
          (leftSlot?.verse ?? Number.MAX_SAFE_INTEGER) -
            (rightSlot?.verse ?? Number.MAX_SAFE_INTEGER) ||
          left.mapping.sourceReferences[0].verse -
            right.mapping.sourceReferences[0].verse
        );
      }),
    }))
    .toSorted(
      (left, right) =>
        (bookOrder.get(left.reference.book) ?? Number.MAX_SAFE_INTEGER) -
          (bookOrder.get(right.reference.book) ?? Number.MAX_SAFE_INTEGER) ||
        left.reference.chapter - right.reference.chapter,
    );
}

function addGreekOmissions(
  chapters: OriginalTextChapter[],
  scrivenerVerses: readonly ScrivenerVerse[],
): void {
  const alternates = new Map(
    scrivenerVerses.map((verse) => [
      canonicalReferenceKey(verse.reference),
      verse.text,
    ]),
  );
  for (const chapter of chapters) {
    if (chapter.translation !== "greek") {
      continue;
    }
    const omissions = internalGaps(chapter).map((verse) => {
      const reference = { ...chapter.reference, verse };
      const alternateText = alternates.get(canonicalReferenceKey(reference));
      if (!alternateText) {
        throw new Error(
          `Scrivener text is missing for OGNT gap ${canonicalReferenceKey(reference)}`,
        );
      }
      return {
        verse,
        type: "manuscript-omission" as const,
        alternateText,
        language: "Greek" as const,
        direction: "ltr" as const,
        sourceLabel: "Scrivener 1894 Textus Receptus",
        sourceUrl: "https://github.com/byztxt/greektext-scrivener",
        license: "Public Domain",
        explanation: "Some manuscripts omit this verse.",
        provenance: "Alternate Greek: Scrivener 1894 Textus Receptus",
      };
    });
    if (omissions.length > 0) {
      chapter.omissions = omissions;
    }
  }
}

function addHebrewOmission(
  chapters: OriginalTextChapter[],
  hebrewVerses: readonly OriginalTextVerse[],
): void {
  const gaps = chapters
    .filter((chapter) => chapter.translation === "hebrew")
    .flatMap((chapter) =>
      internalGaps(chapter).map((verse) => ({ chapter, verse })),
    );
  if (
    gaps.length !== 1 ||
    gaps[0].chapter.reference.book !== "NEH" ||
    gaps[0].chapter.reference.chapter !== 7 ||
    gaps[0].verse !== 68
  ) {
    throw new Error(
      `Unexpected mapped WLC gaps: ${gaps
        .map(
          ({ chapter, verse }) =>
            `${chapter.reference.book}.${chapter.reference.chapter}.${verse}`,
        )
        .join(", ")}`,
    );
  }
  const alternate = hebrewVerses.find((verse) =>
    verse.mapping.sourceReferences.some(
      (source) =>
        source.source === "WLC" &&
        source.book === "Ezra" &&
        source.chapter === 2 &&
        source.verse === 66,
    ),
  );
  if (!alternate) {
    throw new Error("OSHB/WLC Ezra 2:66 is unavailable");
  }
  gaps[0].chapter.omissions = [
    {
      verse: 68,
      type: "manuscript-omission",
      alternateText: alternate.text,
      language: "Hebrew",
      direction: "rtl",
      sourceLabel: "Hebrew supplied from Ezra 2:66; absent from WLC",
      sourceUrl: ORIGINAL_ATTRIBUTIONS.hebrew.url,
      license: ORIGINAL_ATTRIBUTIONS.hebrew.license,
      explanation: "Some manuscripts omit this verse.",
      provenance: "Alternate Hebrew from OSHB/WLC Ezra 2:66",
    },
  ];
}

function internalGaps(chapter: OriginalTextChapter): number[] {
  const mapped = new Set(
    chapter.verses.flatMap((verse) =>
      verse.mapping.canonicalSlots
        .filter(
          (slot) =>
            slot.book === chapter.reference.book &&
            slot.chapter === chapter.reference.chapter,
        )
        .map((slot) => slot.verse),
    ),
  );
  const highest = Math.max(...mapped);
  return Array.from({ length: highest - 1 }, (_, index) => index + 1).filter(
    (verse) => !mapped.has(verse),
  );
}

function canonicalReferenceKey(reference: VerseReference): string {
  return `${reference.book}.${reference.chapter}.${reference.verse}`;
}

async function writeChapters(chapters: OriginalTextChapter[]): Promise<void> {
  for (const chapter of chapters) {
    const directory = path.join(
      outputRoot,
      chapter.translation,
      chapter.reference.book,
    );
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, `${chapter.reference.chapter}.json`),
      `${JSON.stringify(chapter)}\n`,
      "utf8",
    );
  }
}

async function main(): Promise<void> {
  await Promise.all([
    rm(path.join(outputRoot, "hebrew"), { recursive: true, force: true }),
    rm(path.join(outputRoot, "greek"), { recursive: true, force: true }),
  ]);
  const [hebrew, greek, scrivener] = await Promise.all([
    buildHebrew(),
    buildGreek(),
    buildScrivener(),
  ]);
  const chapters = [
    ...groupChapters("hebrew", hebrew),
    ...groupChapters("greek", greek),
  ];
  addGreekOmissions(chapters, scrivener);
  addHebrewOmission(chapters, hebrew);
  await writeChapters(chapters);
  console.log(`Generated ${chapters.length} original-language chapters.`);
}

await main();
