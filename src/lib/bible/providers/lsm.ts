import "server-only";

import { getBook } from "../canon";
import { BibleProviderError, responseError } from "../provider";
import type {
  BibleProvider,
  BibleProviderRequest,
  BookId,
  NormalizedChapter,
  VerseReference,
} from "../types";
import { parseLsmResponse } from "./lsm-parser";
import { readGeneratedOriginalChapter } from "./original";

const LSM_MAX_VERSES_PER_REQUEST = 50;
const LSM_BOOK_IDS: Partial<Record<BookId, string>> = {
  PHM: "Philem",
};
const LSM_HUMAN_BOOK_NAMES: Partial<Record<BookId, string>> = {
  PHM: "Philem.",
};

interface LsmConfig {
  appId: string;
  token: string;
  baseUrl?: string;
}

export class LsmProvider implements BibleProvider {
  readonly id = "lsm" as const;
  private readonly inFlight = new Map<string, Promise<NormalizedChapter>>();
  private readonly baseUrl: string;

  constructor(private readonly config: LsmConfig) {
    this.baseUrl =
      config.baseUrl ?? "https://api.lsm.org/recver/txo.php";
  }

  static fromEnvironment(): LsmProvider {
    const credentials = lsmCredentials();
    return new LsmProvider({
      appId: credentials.appId,
      token: credentials.token,
      ...(process.env.LSM_API_URL
        ? { baseUrl: process.env.LSM_API_URL }
        : {}),
    });
  }

  async getChapter(
    request: BibleProviderRequest,
  ): Promise<readonly NormalizedChapter[]> {
    if (!request.translations.includes("rcv")) {
      return [];
    }
    const key = `${request.reference.book}:${request.reference.chapter}`;
    const existing = this.inFlight.get(key);
    if (existing) {
      return [await existing];
    }
    const pending = this.fetchChapter(request);
    this.inFlight.set(key, pending);
    try {
      return [await pending];
    } finally {
      this.inFlight.delete(key);
    }
  }

  private async fetchChapter(
    request: BibleProviderRequest,
  ): Promise<NormalizedChapter> {
    const book = getBook(request.reference.book);
    const testament = book.testament;
    const source = await readGeneratedOriginalChapter(
      testament === "old" ? "hebrew" : "greek",
      request.reference.book,
      request.reference.chapter,
    );
    const available = uniqueReferences(
      source.verses.flatMap((verse) =>
        verse.mapping.canonicalSlots.filter(
          (slot) =>
            slot.book === request.reference.book &&
            slot.chapter === request.reference.chapter,
        ),
      ),
    );
    const lastVerse = available.at(-1)?.verse;
    if (!lastVerse) {
      throw new BibleProviderError(
        "invalid-response",
        "Canonical chapter metadata did not contain any verses",
        this.id,
        false,
      );
    }
    const requested = Array.from({ length: lastVerse }, (_, index) => ({
      ...request.reference,
      verse: index + 1,
    }));
    const responses = lastVerse <= LSM_MAX_VERSES_PER_REQUEST
      ? [
          await this.fetchVerses(
            request,
            requested,
            book.chapters === 1
              ? `${LSM_HUMAN_BOOK_NAMES[book.id] ?? book.name} 1-${lastVerse}`
              : `${book.name} ${request.reference.chapter}`,
            false,
          ),
        ]
      : await Promise.all(
          chunk(requested, LSM_MAX_VERSES_PER_REQUEST).map((references) =>
            this.fetchVerses(
              request,
              references,
              references.map(formatLsmReference).join(","),
              true,
            ),
          ),
        );
    return {
      reference: request.reference,
      translation: "rcv",
      verses: responses.flatMap(({ chapter }) => chapter.verses),
      attribution:
        responses.find(({ chapter }) => chapter.attribution.text)?.chapter
          .attribution ?? {
          label: "RcV",
          text: "",
        },
    };
  }

  private async fetchVerses(
    request: BibleProviderRequest,
    references: readonly VerseReference[],
    query: string,
    isOsis: boolean,
  ) {
    const url = new URL(this.baseUrl);
    url.searchParams.set("String", query);
    if (isOsis) {
      url.searchParams.set("In", "osis");
    }
    url.searchParams.set("Lang", "eng");
    url.searchParams.set("Out", "json");
    const authorization = Buffer.from(
      `${this.config.appId}:${this.config.token}`,
    ).toString("base64");
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${authorization}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw responseError(response, this.id);
    }
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new BibleProviderError(
        "invalid-response",
        "LSM returned invalid JSON",
        this.id,
        false,
      );
    }
    const parsed = parseLsmResponse(value, request.reference, references);
    if (parsed.chapter.verses.length === 0) {
      throw new BibleProviderError(
        "invalid-response",
        parsed.message || "LSM response did not contain verses",
        this.id,
        false,
      );
    }
    return parsed;
  }
}

export function formatLsmReference(reference: VerseReference): string {
  const book = getBook(reference.book);
  const bookId = LSM_BOOK_IDS[reference.book] ?? book.osisId;
  return book.chapters === 1
    ? `${bookId}.${reference.verse}`
    : `${bookId}.${reference.chapter}.${reference.verse}`;
}

function uniqueReferences(
  references: readonly VerseReference[],
): VerseReference[] {
  return [
    ...new Map(
      references.map((reference) => [reference.verse, reference]),
    ).values(),
  ].sort((left, right) => left.verse - right.verse);
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  return Array.from(
    { length: Math.ceil(values.length / size) },
    (_, index) => values.slice(index * size, (index + 1) * size),
  );
}

function lsmCredentials(): { appId: string; token: string } {
  const appId = process.env.LSM_APP_ID;
  const token = process.env.LSM_API_TOKEN;
  if (appId && token) {
    return { appId, token };
  }
  const combined = process.env.LSM_API_KEY;
  const separator = combined?.indexOf(":") ?? -1;
  if (combined && separator > 0 && separator < combined.length - 1) {
    return {
      appId: combined.slice(0, separator),
      token: combined.slice(separator + 1),
    };
  }
  throw new BibleProviderError(
    "unauthorized",
    "Configure LSM_APP_ID and LSM_API_TOKEN, or set LSM_API_KEY to appid:token",
    "lsm",
    false,
  );
}
