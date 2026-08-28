import { XMLParser } from "fast-xml-parser";

import { BIBLE_BOOKS, getBookByOsisId } from "./canon";
import type {
  Attribution,
  BookId,
  ChapterReference,
  OriginalTextSourceId,
  SourceReference,
  VerseMapping,
  VerseMappingKind,
  VerseReference,
} from "./types";

export interface OriginalTextVerse {
  text: string;
  mapping: VerseMapping;
}

export interface OriginalTextChapter {
  translation: OriginalTextSourceId;
  reference: ChapterReference;
  attribution: Attribution;
  verses: OriginalTextVerse[];
}

export const ORIGINAL_ATTRIBUTIONS = {
  hebrew: {
    label: "OSHB",
    text: "Open Scriptures Hebrew Bible",
    url: "https://github.com/openscriptures/morphhb",
    license: "CC BY 4.0",
  },
  greek: {
    label: "OGNT",
    text: "Open Greek New Testament Project by Eliran Wong",
    url: "https://github.com/eliranwong/OpenGNT",
    license: "CC BY-SA 4.0",
  },
} as const satisfies Record<OriginalTextSourceId, Attribution>;

interface ParsedReference {
  book: string;
  chapter: number;
  verse: number;
  part?: string;
}

interface VerseMapEntry {
  source: ParsedReference;
  target: ParsedReference;
  type: "full" | "partial";
}

type OrderedXmlNode = {
  ":@"?: Record<string, string>;
  [key: string]: unknown;
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  preserveOrder: true,
  processEntities: true,
});

export function parseOsisReference(value: string): ParsedReference {
  const match = /^(?<book>\d?[A-Za-z]+)\.(?<chapter>\d+)\.(?<verse>\d+)(?:!(?<part>[A-Za-z]+))?$/.exec(
    value,
  );
  if (!match?.groups) {
    throw new Error(`Invalid OSIS reference: ${value}`);
  }
  return {
    book: match.groups.book,
    chapter: Number(match.groups.chapter),
    verse: Number(match.groups.verse),
    ...(match.groups.part ? { part: match.groups.part } : {}),
  };
}

export function parseVerseMap(xml: string): Map<string, VerseMapEntry[]> {
  const mappings = new Map<string, VerseMapEntry[]>();
  for (const match of xml.matchAll(/<verse\b(?<attributes>[^>]*)\/>/g)) {
    const attributes = Object.fromEntries(
      [...(match.groups?.attributes ?? "").matchAll(/(\w+)="([^"]*)"/g)].map(
        (attribute) => [attribute[1], attribute[2]],
      ),
    );
    if (!attributes.wlc || !attributes.kjv) {
      continue;
    }
    const source = parseOsisReference(attributes.wlc);
    const entry: VerseMapEntry = {
      source,
      target: parseOsisReference(attributes.kjv),
      type: attributes.type === "partial" ? "partial" : "full",
    };
    const key = referenceKey(source);
    mappings.set(key, [...(mappings.get(key) ?? []), entry]);
  }
  return mappings;
}

export function parseHebrewBook(
  xml: string,
  verseMap: ReadonlyMap<string, VerseMapEntry[]>,
): OriginalTextVerse[] {
  const document = xmlParser.parse(xml) as OrderedXmlNode[];
  const verses: OriginalTextVerse[] = [];
  walkOrderedXml(document, (node) => {
    const children = node.verse;
    const attributes = node[":@"];
    if (!Array.isArray(children) || !attributes?.osisID) {
      return;
    }
    const source = parseOsisReference(attributes.osisID);
    const text = renderHebrewTokens(extractHebrewTokens(children));
    verses.push({
      text,
      mapping: createHebrewMapping(source, verseMap.get(referenceKey(source))),
    });
  });
  return verses;
}

export function parseGreekTsv(tsv: string): OriginalTextVerse[] {
  const verses = new Map<string, { reference: VerseReference; words: string[] }>();
  const lines = tsv.replace(/^\uFEFF/, "").split(/\r?\n/);
  for (const line of lines.slice(1)) {
    if (!line.trim()) {
      continue;
    }
    const columns = line.split("\t");
    const location = parseWrappedValues(columns[6]);
    const wordData = parseWrappedValues(columns[7]);
    const punctuation = parseWrappedValues(columns[11]);
    if (location.length !== 3 || wordData.length < 3) {
      throw new Error(`Invalid OpenGNT row: ${line.slice(0, 80)}`);
    }
    const bookNumber = Number(location[0]);
    const book = BIBLE_BOOKS[bookNumber - 1];
    if (!book || book.testament !== "new") {
      throw new Error(`Invalid OpenGNT book number: ${location[0]}`);
    }
    const reference = {
      book: book.id,
      chapter: Number(location[1]),
      verse: Number(location[2]),
    };
    const key = canonicalReferenceKey(reference);
    const word = `${cleanPunctuation(punctuation[0])}${wordData[2]}${cleanPunctuation(punctuation[1])}`;
    const verse = verses.get(key) ?? { reference, words: [] };
    verse.words.push(word);
    verses.set(key, verse);
  }
  return [...verses.values()].map(({ reference, words }) => ({
    text: words.join(" "),
    mapping: {
      sourceReferences: [
        {
          source: "OGNT",
          book: getBookOsisId(reference.book),
          chapter: reference.chapter,
          verse: reference.verse,
        },
      ],
      canonicalSlots: [reference],
      kind: "one-to-one",
    },
  }));
}

function parseWrappedValues(value: string | undefined): string[] {
  if (!value?.startsWith("〔") || !value.endsWith("〕")) {
    return [];
  }
  return value.slice(1, -1).split("｜");
}

function cleanPunctuation(value: string | undefined): string {
  return value?.replace(/<[^>]+>/g, "") ?? "";
}

function createHebrewMapping(
  source: ParsedReference,
  entries: VerseMapEntry[] | undefined,
): VerseMapping {
  const sourceReferences: SourceReference[] = entries?.map((entry) => ({
    source: "WLC",
    ...entry.source,
  })) ?? [{ source: "WLC", ...source }];
  const canonicalSlots = entries?.map((entry) =>
    toCanonicalReference(entry.target),
  ) ?? [toCanonicalReference(source)];

  if (
    entries?.some((entry) => entry.type === "partial") &&
    !canonicalSlots.some((slot) => isSameBaseReference(slot, source))
  ) {
    sourceReferences.push({ source: "WLC", ...source });
    canonicalSlots.push(toCanonicalReference(source));
  }

  const uniqueSources = uniqueBy(sourceReferences, sourceReferenceKey);
  const uniqueSlots = uniqueBy(canonicalSlots, canonicalReferenceKey);
  return {
    sourceReferences: uniqueSources,
    canonicalSlots: uniqueSlots,
    kind: mappingKind(uniqueSources.length, uniqueSlots.length),
  };
}

function toCanonicalReference(reference: ParsedReference): VerseReference {
  const book = getBookByOsisId(reference.book);
  if (!book) {
    throw new Error(`Unknown OSIS book: ${reference.book}`);
  }
  return {
    book: book.id,
    chapter: reference.chapter,
    verse: reference.verse,
  };
}

function getBookOsisId(bookId: BookId): string {
  const book = BIBLE_BOOKS.find((entry) => entry.id === bookId);
  if (!book) {
    throw new Error(`Unknown book: ${bookId}`);
  }
  return book.osisId;
}

function referenceKey(reference: ParsedReference): string {
  return `${reference.book}.${reference.chapter}.${reference.verse}`;
}

function canonicalReferenceKey(reference: VerseReference): string {
  return `${reference.book}.${reference.chapter}.${reference.verse}`;
}

function sourceReferenceKey(reference: SourceReference): string {
  return `${reference.source}.${reference.book}.${reference.chapter}.${reference.verse}.${reference.part ?? ""}`;
}

function isSameBaseReference(
  canonical: VerseReference,
  source: ParsedReference,
): boolean {
  const book = getBookByOsisId(source.book);
  return (
    book?.id === canonical.book &&
    source.chapter === canonical.chapter &&
    source.verse === canonical.verse
  );
}

function uniqueBy<T>(values: T[], key: (value: T) => string): T[] {
  return [...new Map(values.map((value) => [key(value), value])).values()];
}

function mappingKind(
  sourceCount: number,
  canonicalCount: number,
): VerseMappingKind {
  if (sourceCount === 1 && canonicalCount === 1) {
    return "one-to-one";
  }
  if (sourceCount === 1) {
    return "one-to-many";
  }
  if (canonicalCount === 1) {
    return "many-to-one";
  }
  return "many-to-many";
}

function walkOrderedXml(
  nodes: OrderedXmlNode[],
  visit: (node: OrderedXmlNode) => void,
): void {
  for (const node of nodes) {
    visit(node);
    for (const [key, children] of Object.entries(node)) {
      if (key !== ":@" && Array.isArray(children)) {
        walkOrderedXml(children, visit);
      }
    }
  }
}

function extractHebrewTokens(
  nodes: OrderedXmlNode[],
): { type: "word" | "segment"; value: string }[] {
  const tokens: { type: "word" | "segment"; value: string }[] = [];
  for (const node of nodes) {
    if (Array.isArray(node.w)) {
      tokens.push({
        type: "word",
        value: nodeText(node.w).replaceAll("/", ""),
      });
    } else if (Array.isArray(node.seg)) {
      tokens.push({ type: "segment", value: nodeText(node.seg) });
    }
  }
  return tokens;
}

function nodeText(nodes: OrderedXmlNode[]): string {
  return nodes
    .flatMap((node) => {
      const text = node["#text"];
      return typeof text === "string" ? [text] : [];
    })
    .join("");
}

function renderHebrewTokens(
  tokens: { type: "word" | "segment"; value: string }[],
): string {
  let text = "";
  let previousWasMaqqef = false;
  for (const token of tokens) {
    if (token.type === "word") {
      text += text && !previousWasMaqqef ? ` ${token.value}` : token.value;
      previousWasMaqqef = false;
    } else if (token.value === "־" || token.value === "׃") {
      text += token.value;
      previousWasMaqqef = token.value === "־";
    } else {
      text += ` ${token.value}`;
      previousWasMaqqef = false;
    }
  }
  return text.trim();
}
