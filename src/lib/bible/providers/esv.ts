import "server-only";

import { ExpiringWeightCache } from "../cache";
import { getBook } from "../canon";
import { BibleProviderError, responseError } from "../provider";
import type {
  BibleProvider,
  BibleProviderRequest,
  ChapterReference,
  NormalizedChapter,
} from "../types";
import { parseEsvResponse } from "./esv-parser";

const ESV_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const ESV_CACHE_MAX_VERSES = 500;

interface EsvConfig {
  token: string;
  baseUrl?: string;
}

export class EsvProvider implements BibleProvider {
  readonly id = "esv" as const;
  private readonly cache = new ExpiringWeightCache<NormalizedChapter>(
    ESV_CACHE_MAX_VERSES,
    ESV_CACHE_TTL_MS,
  );
  private readonly baseUrl: string;

  constructor(private readonly config: EsvConfig) {
    this.baseUrl = config.baseUrl ?? "https://api.esv.org/v3/passage/html/";
  }

  static fromEnvironment(): EsvProvider {
    const token = process.env.ESV_API_TOKEN ?? process.env.ESV_API_KEY;
    if (!token) {
      throw new BibleProviderError(
        "unauthorized",
        "ESV_API_TOKEN is not configured",
        "esv",
        false,
      );
    }
    return new EsvProvider({ token });
  }

  async getChapter(
    request: BibleProviderRequest,
  ): Promise<readonly NormalizedChapter[]> {
    if (!request.translations.includes("esv")) {
      return [];
    }
    const key = `${request.reference.book}:${request.reference.chapter}`;
    const cached = this.cache.get(key);
    if (cached) {
      return [cached];
    }
    const url = new URL(this.baseUrl);
    url.searchParams.set("q", formatEsvChapterQuery(request.reference));
    url.searchParams.set("include-passage-references", "false");
    url.searchParams.set("include-first-verse-numbers", "true");
    url.searchParams.set("include-verse-numbers", "true");
    url.searchParams.set("include-verse-anchors", "true");
    url.searchParams.set("include-footnotes", "false");
    url.searchParams.set("include-headings", "false");
    url.searchParams.set("include-crossrefs", "false");
    url.searchParams.set("include-short-copyright", "false");
    url.searchParams.set("include-copyright", "true");
    url.searchParams.set("include-audio-link", "false");

    const response = await fetch(url, {
      headers: { Authorization: `Token ${this.config.token}` },
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
        "ESV returned invalid JSON",
        this.id,
        false,
      );
    }
    const chapter = parseEsvResponse(value, request.reference);
    if (chapter.verses.length === 0) {
      throw new BibleProviderError(
        "invalid-response",
        "ESV response did not contain verse anchors",
        this.id,
        false,
      );
    }
    this.cache.set(key, chapter, chapter.verses.length);
    return [chapter];
  }
}

export function formatEsvChapterQuery(reference: ChapterReference): string {
  const book = getBook(reference.book);
  return book.chapters === 1 ? book.name : `${book.name} ${reference.chapter}`;
}
