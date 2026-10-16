import { getTranslation } from "../canon";
import { htmlToText } from "../html";
import type {
  ChapterReference,
  FumsMetadata,
  NormalizedChapter,
  NormalizedVerse,
  TranslationId,
} from "../types";

type UnknownRecord = Record<string, unknown>;

export function parseApiBibleResponse(
  value: unknown,
  reference: ChapterReference,
  bibleIds: ReadonlyMap<string, TranslationId>,
): NormalizedChapter[] {
  const root = asRecord(value);
  if (!root) {
    return [];
  }
  const rootData = root.data;
  const candidates = collectCandidates(rootData);
  const rootMeta = readFums(root.meta);
  const rootCopyright = stringValue(root.copyright);
  const chapters: NormalizedChapter[] = [];

  for (const [index, candidate] of candidates.entries()) {
    const bibleId =
      stringValue(candidate.bibleId) ??
      stringValue(asRecord(candidate.bible)?.id);
    const translation =
      (bibleId ? bibleIds.get(bibleId) : undefined) ??
      (candidates.length === 1 ? [...bibleIds.values()][0] : undefined) ??
      (index === 0 ? [...bibleIds.values()][0] : undefined);
    if (!translation) {
      continue;
    }
    const content = candidate.content ?? candidate.passages;
    const verses = parseApiBibleContent(content, reference);
    const copyright =
      stringValue(candidate.copyright) ??
      stringValue(asRecord(candidate.meta)?.copyright) ??
      rootCopyright ??
      "";
    chapters.push({
      reference,
      translation,
      verses,
      attribution: {
        label: getTranslation(translation).abbreviation,
        text: copyright,
      },
      fums: readFums(candidate.meta) ?? rootMeta,
    });
  }
  return chapters;
}

export function parseApiBibleContent(
  content: unknown,
  reference: ChapterReference,
): NormalizedVerse[] {
  if (typeof content === "string") {
    return parseHtmlContent(content, reference);
  }
  if (Array.isArray(content) || asRecord(content)) {
    return parseJsonContent(content, reference);
  }
  return [];
}

function collectCandidates(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectCandidates);
  }
  const record = asRecord(value);
  if (!record) {
    return [];
  }
  const direct = "content" in record || "passages" in record ? [record] : [];
  const parallels = Array.isArray(record.parallels)
    ? record.parallels.flatMap(collectCandidates)
    : [];
  return [...direct, ...parallels];
}

function parseHtmlContent(
  html: string,
  reference: ChapterReference,
): NormalizedVerse[] {
  const marker =
    /<[^>]*\b(?:data-sid|data-verse-id)=["'][^"']*?\.(\d+)\.(\d+)(?:[^"']*)["'][^>]*>/giu;
  const matches = [...html.matchAll(marker)].filter(
    (match) => Number(match[1]) === reference.chapter,
  );
  return matches.flatMap((match, index) => {
    const verse = Number(match[2]);
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? html.length;
    const text = htmlToText(
      html
        .slice(start, end)
        .replace(
          /^[\s\S]*?<\/span>\s*/u,
          "",
        ),
    ).replace(new RegExp(`^${verse}\\s+`, "u"), "");
    return text ? [normalizedVerse(reference, verse, text)] : [];
  });
}

function parseJsonContent(
  content: unknown,
  reference: ChapterReference,
): NormalizedVerse[] {
  const texts = new Map<number, string[]>();
  const state: { verse?: number; skipDepth: number } = { skipDepth: 0 };

  // USFM tags from NIV API call, universal across major versions
  const LINE_BREAK_STYLES = new Set(["q", "q1", "q2", "q3", "q4", "b", "p", "m"]);
  const appendText = (verse: number, text: string) => {
    const current = texts.get(verse) ?? [];
    texts.set(verse, [...current, text]);
  };

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) {
        walk(child);
      }
      return;
    }
    const record = asRecord(node);
    if (!record) {
      return;
    }
    const attrs = asRecord(record.attrs) ?? asRecord(record.attributes);
    const verseId =
      firstString(attrs?.verseId) ??
      firstString(attrs?.["data-sid"]) ??
      firstString(record.verseId);
    const parsed = verseId ? parseVerseId(verseId) : undefined;
    if (parsed?.chapter === reference.chapter) {
      state.verse = parsed.verse;
    }

    // use '\n' characters to indicate where poetry line breaks / paragraph breaks occur
    // the '\n' character does not appear in the API calls' text itself. if they did, they would be considered line breaks
    const styleAttr = stringValue(attrs?.style) ?? stringValue(record.style);
    if (styleAttr && LINE_BREAK_STYLES.has(styleAttr) && state.verse !== undefined && state.skipDepth === 0) {
      appendText(state.verse, "\n");
    }

    const classes = [
      ...stringArray(attrs?.class),
      ...stringArray(record.class),
    ];
    const styles = [
      ...stringArray(attrs?.style),
      ...stringArray(record.style),
    ];
    const skipsText =
      stringValue(record.name) === "verse" ||
      classes.some((name) =>
        ["v", "verse-number", "verse-num"].includes(name),
      ) ||
      styles.includes("v");
    if (skipsText) {
      state.skipDepth += 1;
    }
    const text = stringValue(record.text);
    if (text && state.verse !== undefined && state.skipDepth === 0) {
      appendText(state.verse, text);
    }
    for (const key of ["items", "children", "content"]) {
      if (key in record) {
        walk(record[key]);
      }
    }
    if (skipsText) {
      state.skipDepth -= 1;
    }
  };

  walk(content);
  return [...texts.entries()]
    .sort(([left], [right]) => left - right)
    .flatMap(([verse, parts]) => {
      const rawLines = parts.join("").split("\n");
      
      // make a list of lines (strings)
      const lines = rawLines
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      // concatenate lines
      const text = htmlToText(lines.join(" / "));
      return text ? [normalizedVerse(reference, verse, text)] : [];
    });
}

function normalizedVerse(
  reference: ChapterReference,
  verse: number,
  text: string,
): NormalizedVerse {
  return {
    slots: [{ ...reference, verse }],
    sourceReferences: [
      {
        source: "API.Bible",
        book: reference.book,
        chapter: reference.chapter,
        verse,
      },
    ],
    text,
  };
}

function parseVerseId(
  value: string,
): { chapter: number; verse: number } | undefined {
  const match = /\.(\d+)\.(\d+)(?:[!-].*)?$/u.exec(value);
  return match
    ? { chapter: Number(match[1]), verse: Number(match[2]) }
    : undefined;
}

function readFums(value: unknown): FumsMetadata | undefined {
  const record = asRecord(value);
  const fumsToken = stringValue(record?.fumsToken);
  const fumsId = stringValue(record?.fumsId) ?? fumsToken;
  if (!record || !fumsId) {
    return undefined;
  }
  return {
    fumsId,
    ...(fumsToken ? { fumsToken } : {}),
    ...(stringValue(record.fums) ? { fums: stringValue(record.fums) } : {}),
    ...(stringValue(record.fumsJsInclude)
      ? { fumsJsInclude: stringValue(record.fumsJsInclude) }
      : {}),
    ...(stringValue(record.fumsJs)
      ? { fumsJs: stringValue(record.fumsJs) }
      : {}),
    ...(stringValue(record.fumsNoScript)
      ? { fumsNoScript: stringValue(record.fumsNoScript) }
      : {}),
  };
}

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function firstString(value: unknown): string | undefined {
  return stringArray(value)[0];
}

function stringArray(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}
