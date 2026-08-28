import { readFile, rm, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { strFromU8, unzipSync } from "fflate";

import { BIBLE_BOOKS } from "../src/lib/bible/canon";
import {
  ORIGINAL_ATTRIBUTIONS,
  parseGreekTsv,
  parseHebrewBook,
  parseVerseMap,
  type OriginalTextChapter,
  type OriginalTextVerse,
} from "../src/lib/bible/original-texts";
import type {
  ChapterReference,
  OriginalTextSourceId,
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
  const [hebrew, greek] = await Promise.all([buildHebrew(), buildGreek()]);
  const chapters = [
    ...groupChapters("hebrew", hebrew),
    ...groupChapters("greek", greek),
  ];
  await writeChapters(chapters);
  console.log(`Generated ${chapters.length} original-language chapters.`);
}

await main();
