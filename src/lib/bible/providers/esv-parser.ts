import { htmlToText } from "../html";
import type {
  ChapterReference,
  NormalizedChapter,
  NormalizedVerse,
} from "../types";

type UnknownRecord = Record<string, unknown>;

export function parseEsvResponse(
  value: unknown,
  reference: ChapterReference,
): NormalizedChapter {
  const record = asRecord(value);
  const passages = Array.isArray(record?.passages)
    ? record.passages.filter(
        (passage): passage is string => typeof passage === "string",
      )
    : [];
  const verses = passages.flatMap((passage) =>
    parseEsvPassageHtml(passage, reference),
  );
  return {
    reference,
    translation: "esv",
    verses,
    attribution: {
      label: "ESV",
      text:
        typeof record?.copyright === "string"
          ? record.copyright
          : extractShortCopyright(passages),
    },
  };
}

export function parseEsvPassageHtml(
  html: string,
  reference: ChapterReference,
): NormalizedVerse[] {
  const content = removeShortCopyright(html);
  const marker =
    /<([a-z][\w:-]*)\b[^>]*\bid=["']v\d{2}(\d{3})(\d{3})-\d+["'][^>]*>[\s\S]*?<\/\1>/giu;
  const matches = [...content.matchAll(marker)].filter(
    (match) => Number(match[2]) === reference.chapter,
  );
  return matches.flatMap((match, index) => {
    const verse = Number(match[3]);
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? content.length;
    const text = htmlToText(
      content
        .slice(start, end)
        .replace(/<span\b[^>]*class=["'][^"']*\bfootnote\b[^"']*["'][^>]*>[\s\S]*?<\/span>/giu, ""),
    );
    return text
      ? [
          {
            slots: [{ ...reference, verse }],
            sourceReferences: [
              {
                source: "ESV",
                book: reference.book,
                chapter: reference.chapter,
                verse,
              },
            ],
            text,
          },
        ]
      : [];
  });
}

function extractShortCopyright(passages: readonly string[]): string {
  for (const passage of passages) {
    for (const match of passage.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/giu)) {
      if (/\bclass=["'][^"']*\bcopyright\b[^"']*["']/iu.test(match[0])) {
        return htmlToText(match[0]);
      }
    }
  }
  return "";
}

function removeShortCopyright(html: string): string {
  return html.replace(
    /<p\b[^>]*>[\s\S]*?<\/p>/giu,
    (paragraph) =>
      /\bclass=["'][^"']*\bcopyright\b[^"']*["']/iu.test(paragraph)
        ? ""
        : paragraph,
  );
}

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}
