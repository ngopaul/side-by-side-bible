import "server-only";

import { ExpiringWeightCache } from "../cache";
import { getBook } from "../canon";
import { BibleProviderError, responseError } from "../provider";
import type {
  BibleProvider,
  BibleProviderRequest,
  NormalizedChapter,
  TranslationId,
} from "../types";
import { parseApiBibleResponse } from "./api-bible-parser";

const API_BIBLE_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1_000;
const API_BIBLE_TRANSLATIONS = ["nasb", "nkjv", "niv"] as const;
const AUTHORIZED_BIBLE_IDS = {
  nasb: "a761ca71e0b3ddcf-01",
  nkjv: "63097d2a0a2f7db3-01",
  niv: "78a9f6124f344018-01",
} as const;

interface ApiBibleConfig {
  apiKey: string;
  baseUrl?: string;
  bibleIds: Readonly<Partial<Record<TranslationId, string>>>;
}

export class ApiBibleProvider implements BibleProvider {
  readonly id = "api-bible" as const;
  private readonly cache = new ExpiringWeightCache<NormalizedChapter>(
    Number.MAX_SAFE_INTEGER,
    API_BIBLE_CACHE_TTL_MS,
  );
  private readonly baseUrl: string;

  constructor(private readonly config: ApiBibleConfig) {
    this.baseUrl = config.baseUrl ?? "https://rest.api.bible/v1";
  }

  static fromEnvironment(): ApiBibleProvider {
    return new ApiBibleProvider({
      apiKey: requiredEnvironment("API_BIBLE_KEY"),
      bibleIds: {
        nasb: process.env.API_BIBLE_NASB_ID || AUTHORIZED_BIBLE_IDS.nasb,
        nkjv: process.env.API_BIBLE_NKJV_ID || AUTHORIZED_BIBLE_IDS.nkjv,
        niv: process.env.API_BIBLE_NIV_ID || AUTHORIZED_BIBLE_IDS.niv,
      },
    });
  }

  async getChapter(
    request: BibleProviderRequest,
  ): Promise<readonly NormalizedChapter[]> {
    const translations = request.translations.filter(
      (translation): translation is (typeof API_BIBLE_TRANSLATIONS)[number] =>
        API_BIBLE_TRANSLATIONS.includes(
          translation as (typeof API_BIBLE_TRANSLATIONS)[number],
        ),
    );
    const chapters: NormalizedChapter[] = [];
    const missing: TranslationId[] = [];
    for (const translation of translations) {
      const cached = this.cache.get(cacheKey(translation, request));
      if (cached) {
        chapters.push(cached);
      } else {
        missing.push(translation);
      }
    }
    if (missing.length === 0) {
      return chapters;
    }

    const bibleIds = new Map<string, TranslationId>();
    for (const translation of missing) {
      const bibleId = this.config.bibleIds[translation];
      if (!bibleId) {
        throw new BibleProviderError(
          "unauthorized",
          `API.Bible ID is not configured for ${translation}`,
          this.id,
          false,
        );
      }
      bibleIds.set(bibleId, translation);
    }
    const [primaryBibleId, ...parallelBibleIds] = bibleIds.keys();
    const book = getBook(request.reference.book);
    const url = new URL(
      `${this.baseUrl}/bibles/${encodeURIComponent(primaryBibleId)}/chapters/${book.apiBibleId}.${request.reference.chapter}`,
    );
    url.searchParams.set("content-type", "json");
    url.searchParams.set("include-verse-spans", "true");
    url.searchParams.set("include-notes", "false");
    url.searchParams.set("include-titles", "false");
    url.searchParams.set("include-chapter-numbers", "false");
    url.searchParams.set("include-verse-numbers", "true");
    url.searchParams.set("fums-version", "3");
    if (parallelBibleIds.length > 0) {
      url.searchParams.set("parallels", parallelBibleIds.join(","));
    }

    const response = await fetch(url, {
      headers: { "api-key": this.config.apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw responseError(response, this.id);
    }
    const parsed = parseApiBibleResponse(
      await readJson(response, this.id),
      request.reference,
      bibleIds,
    ).filter((chapter) => chapter.verses.length > 0);
    if (parsed.length === 0) {
      throw new BibleProviderError(
        "invalid-response",
        "API.Bible response did not contain verse content",
        this.id,
        false,
      );
    }
    for (const chapter of parsed) {
      this.cache.set(
        cacheKey(chapter.translation, request),
        chapter,
        chapter.verses.length,
      );
    }
    return [...chapters, ...parsed];
  }
}

async function readJson(
  response: Response,
  provider: "api-bible",
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new BibleProviderError(
      "invalid-response",
      "API.Bible returned invalid JSON",
      provider,
      false,
    );
  }
}

function cacheKey(
  translation: TranslationId,
  request: BibleProviderRequest,
): string {
  return `${translation}:${request.reference.book}:${request.reference.chapter}`;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new BibleProviderError(
      "unauthorized",
      `${name} is not configured`,
      "api-bible",
      false,
    );
  }
  return value;
}
