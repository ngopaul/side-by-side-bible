"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ScriptureGrid } from "@/components/scripture-grid";
import {
  BIBLE_BOOKS,
  getBook,
  getTranslation,
} from "@/lib/bible/canon";
import {
  chapterSectionRanges,
  resolveChapterPart,
} from "@/lib/bible/chapter-sections";
import type {
  BibleBook,
  BookId,
  ChapterMatrix,
  TranslationId,
} from "@/lib/bible/types";
import {
  loadPreferences,
  parseVersionsParam,
  savePreferences,
  type ReaderPreferences,
} from "@/lib/preferences";

interface ReaderProps {
  book: BookId;
  chapter: number;
}

const chapterCache = new Map<string, ChapterMatrix>();
const chapterRequests = new Map<string, ChapterRequest>();
const MAX_CACHED_CHAPTERS = 3;
let memoryDeviceId: string | undefined;
let memorySessionId: string | undefined;

interface ChapterRequest {
  controller: AbortController;
  promise: Promise<ChapterMatrix>;
  users: number;
  settled: boolean;
  abortTimer?: ReturnType<typeof setTimeout>;
}

export function Reader({ book, chapter }: ReaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const versionsValue = searchParams.get("versions");
  const partValue = searchParams.get("part");
  const urlVersions = useMemo(
    () => parseVersionsParam(versionsValue),
    [versionsValue],
  );
  const [preferences, setPreferences] = useState<ReaderPreferences>();
  const [matrix, setMatrix] = useState<ChapterMatrix>();
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const versions = urlVersions ?? preferences?.versions;
  const versionsKey = versions?.join(",") ?? "";
  const cacheKey = `${book}:${chapter}:${versionsKey}`;
  const currentBook = getBook(book);
  const currentMatrix =
    matrix?.reference.book === book && matrix.reference.chapter === chapter
      ? matrix
      : undefined;
  const ranges = useMemo(
    () => chapterSectionRanges(currentMatrix?.rows ?? 0),
    [currentMatrix],
  );
  const partResolution = resolveChapterPart(partValue, ranges.length);
  const activePart = partResolution.part;

  useEffect(() => {
    queueMicrotask(() => setPreferences(loadPreferences(window.localStorage)));
  }, []);

  useEffect(() => {
    if (!preferences || !versions) {
      return;
    }
    if (!urlVersions) {
      router.replace(
        chapterHref(book, chapter, versions, partValue ?? undefined),
        { scroll: false },
      );
      return;
    }
    if (versionsValue !== urlVersions.join(",")) {
      router.replace(
        chapterHref(book, chapter, urlVersions, partValue ?? undefined),
        { scroll: false },
      );
    }
    if (preferences.versions.join(",") !== urlVersions.join(",")) {
      savePreferences(window.localStorage, {
        ...preferences,
        versions: [...urlVersions],
      });
    }
  }, [
    book,
    chapter,
    preferences,
    partValue,
    router,
    urlVersions,
    versions,
    versionsValue,
  ]);

  useEffect(() => {
    if (!versions) {
      return;
    }
    const selectedVersions = versions;
    let active = true;
    let releaseRequest = () => {};
    async function loadChapter() {
      const cached = retryCount === 0 ? chapterCache.get(cacheKey) : undefined;
      if (cached) {
        touchCache(cacheKey, cached);
        setMatrix(cached);
        setRequestError(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      setRequestError(false);
      if (!chapterCache.has(cacheKey)) {
        setMatrix(undefined);
      }
      const query = new URLSearchParams({
        book,
        chapter: String(chapter),
        versions: selectedVersions.join(","),
      });
      const request = acquireChapterRequest(
        cacheKey,
        `/api/bible/chapter?${query}`,
      );
      releaseRequest = request.release;
      try {
        const result = await request.promise;
        if (!active) {
          return;
        }
        touchCache(cacheKey, result);
        setMatrix(result);
        setRequestError(false);
      } catch (error: unknown) {
        if (
          !active ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        setMatrix(undefined);
        setRequestError(true);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void loadChapter();

    return () => {
      active = false;
      releaseRequest();
    };
  }, [book, cacheKey, chapter, retryCount, versions]);

  useEffect(() => {
    if (
      !currentMatrix ||
      !versions ||
      !partResolution.canonicalize
    ) {
      return;
    }
    router.replace(
      chapterHref(book, chapter, versions, partResolution.part),
      { scroll: false },
    );
  }, [
    book,
    chapter,
    currentMatrix,
    partResolution.canonicalize,
    partResolution.part,
    router,
    versions,
  ]);

  useEffect(() => {
    if (!matrix || matrix.reference.book !== book || matrix.reference.chapter !== chapter) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const reports = new Map(
        matrix.versions
          .filter((version) => version.fums && !version.error)
          .map((version) => [version.fums!.fumsId, version.fums!]),
      );
      const deviceId = trackingId("local", "device");
      const sessionId = trackingId("session", "session");
      for (const report of reports.values()) {
        void fetch(report.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: report.token,
            deviceId,
            sessionId,
          }),
          keepalive: true,
        });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [book, chapter, matrix]);

  const visibleBooks = useMemo(
    () => navigationBooks(preferences, book),
    [book, preferences],
  );
  const previous = adjacentChapter(visibleBooks, book, chapter, -1);
  const next = adjacentChapter(visibleBooks, book, chapter, 1);
  const retry = () => setRetryCount((value) => value + 1);

  return (
    <main className="reader-shell">
      <ReaderToolbar
        book={currentBook}
        chapter={chapter}
        versions={versions ?? []}
        books={visibleBooks}
        previous={previous}
        next={next}
        onNavigate={(href) => router.push(href)}
      />
      <div className="reader-heading">
        <div>
          <span className="eyebrow">Reading</span>
          <h1>
            {currentBook.name} <span>{chapter}</span>
          </h1>
        </div>
        {versions ? (
          <p>
            {versions
              .map(
                (id) =>
                  currentMatrix?.versions.find(
                    ({ translation }) => translation.id === id,
                  )?.translation.abbreviation ??
                  getTranslation(id).abbreviation,
              )
              .join(" · ")}
          </p>
        ) : null}
      </div>
      <ScriptureGrid
        matrix={requestError ? undefined : currentMatrix}
        loading={loading}
        requestedVersions={versions ?? []}
        activePart={activePart}
        ranges={ranges}
        onPartChange={(part) => {
          if (versions) {
            router.push(chapterHref(book, chapter, versions, part), {
              scroll: false,
            });
          }
        }}
        onRetry={retry}
      />
    </main>
  );
}

function ReaderToolbar({
  book,
  chapter,
  versions,
  books,
  previous,
  next,
  onNavigate,
}: {
  book: BibleBook;
  chapter: number;
  versions: readonly TranslationId[];
  books: readonly BibleBook[];
  previous: { book: BookId; chapter: number } | null;
  next: { book: BookId; chapter: number } | null;
  onNavigate: (href: string) => void;
}) {
  const currentHref = chapterHref(book.id, chapter, versions);
  return (
    <header className="reader-toolbar" data-testid="reader-toolbar">
      <div className="toolbar-content">
        <Link className="product-link" href="/" prefetch={false}>
          <span className="product-mark" aria-hidden="true">S</span>
          <span>Side-by-Side Bible</span>
        </Link>
        <nav className="chapter-controls" aria-label="Chapter navigation">
          <label>
            <span className="sr-only">Book</span>
            <select
              aria-label="Book"
              value={book.id}
              onChange={(event) =>
                onNavigate(
                  chapterHref(event.target.value as BookId, 1, versions),
                )
              }
            >
              <optgroup label="Old Testament">
                {books
                  .filter(({ testament }) => testament === "old")
                  .map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="New Testament">
                {books
                  .filter(({ testament }) => testament === "new")
                  .map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </label>
          <label>
            <span className="sr-only">Chapter</span>
            <select
              aria-label="Chapter"
              value={chapter}
              onChange={(event) =>
                onNavigate(
                  chapterHref(book.id, Number(event.target.value), versions),
                )
              }
            >
              {Array.from({ length: book.chapters }, (_, index) => index + 1).map(
                (number) => (
                  <option key={number} value={number}>
                    {number}
                  </option>
                ),
              )}
            </select>
          </label>
          {previous ? (
            <Link
              className="icon-button"
              href={chapterHref(previous.book, previous.chapter, versions)}
              aria-label="Previous chapter"
              prefetch={false}
            >
              ←
            </Link>
          ) : (
            <span className="icon-button disabled" aria-hidden="true">←</span>
          )}
          {next ? (
            <Link
              className="icon-button"
              href={chapterHref(next.book, next.chapter, versions)}
              aria-label="Next chapter"
              prefetch={false}
            >
              →
            </Link>
          ) : (
            <span className="icon-button disabled" aria-hidden="true">→</span>
          )}
        </nav>
        <nav className="utility-links" aria-label="Site">
          <Link
            href={`/settings?returnTo=${encodeURIComponent(currentHref)}`}
            prefetch={false}
          >
            Settings
          </Link>
          <Link href="/about" prefetch={false}>About</Link>
        </nav>
      </div>
    </header>
  );
}

function chapterHref(
  book: BookId,
  chapter: number,
  versions: readonly TranslationId[],
  part?: number | string,
): string {
  const href = `/read/${book}/${chapter}?versions=${versions.join(",")}`;
  return part === undefined
    ? href
    : `${href}&part=${encodeURIComponent(String(part))}`;
}

function navigationBooks(
  preferences: ReaderPreferences | undefined,
  currentBook: BookId,
): BibleBook[] {
  if (!preferences) {
    return [...BIBLE_BOOKS];
  }
  const selected = new Set<BookId>([...preferences.books, currentBook]);
  return BIBLE_BOOKS.filter(({ id }) => selected.has(id));
}

function adjacentChapter(
  books: readonly BibleBook[],
  book: BookId,
  chapter: number,
  direction: -1 | 1,
): { book: BookId; chapter: number } | null {
  const index = books.findIndex(({ id }) => id === book);
  if (direction === -1) {
    if (chapter > 1) {
      return { book, chapter: chapter - 1 };
    }
    const previousBook = books[index - 1];
    return previousBook
      ? { book: previousBook.id, chapter: previousBook.chapters }
      : null;
  }
  const currentBook = books[index];
  if (chapter < currentBook.chapters) {
    return { book, chapter: chapter + 1 };
  }
  const nextBook = books[index + 1];
  return nextBook ? { book: nextBook.id, chapter: 1 } : null;
}

function touchCache(key: string, matrix: ChapterMatrix): void {
  chapterCache.delete(key);
  chapterCache.set(key, matrix);
  while (chapterCache.size > MAX_CACHED_CHAPTERS) {
    const oldest = chapterCache.keys().next().value as string | undefined;
    if (!oldest) {
      break;
    }
    chapterCache.delete(oldest);
  }
}

function acquireChapterRequest(
  key: string,
  url: string,
): { promise: Promise<ChapterMatrix>; release: () => void } {
  let request = chapterRequests.get(key);
  if (!request) {
    const controller = new AbortController();
    request = {
      controller,
      users: 0,
      settled: false,
      promise: fetch(url, {
        cache: "no-store",
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Chapter request failed with ${response.status}`);
        }
        return (await response.json()) as ChapterMatrix;
      }),
    };
    const createdRequest = request;
    void request.promise.finally(() => {
      createdRequest.settled = true;
      if (createdRequest.users === 0) {
        chapterRequests.delete(key);
      }
    }).catch(() => {});
    chapterRequests.set(key, request);
  }
  if (request.abortTimer) {
    clearTimeout(request.abortTimer);
    request.abortTimer = undefined;
  }
  request.users += 1;
  const acquiredRequest = request;
  return {
    promise: request.promise,
    release: () => {
      acquiredRequest.users = Math.max(0, acquiredRequest.users - 1);
      if (acquiredRequest.users > 0) {
        return;
      }
      if (acquiredRequest.settled) {
        chapterRequests.delete(key);
        return;
      }
      acquiredRequest.abortTimer = setTimeout(() => {
        if (acquiredRequest.users === 0) {
          acquiredRequest.controller.abort();
          chapterRequests.delete(key);
        }
      }, 0);
    },
  };
}

function trackingId(kind: "local" | "session", name: "device" | "session"): string {
  const storage = kind === "local" ? window.localStorage : window.sessionStorage;
  const key = `side-by-side-bible.${name}-id`;
  try {
    const stored = storage.getItem(key);
    if (stored) {
      return stored;
    }
    const created = crypto.randomUUID();
    storage.setItem(key, created);
    return created;
  } catch {
    if (name === "device") {
      memoryDeviceId ??= crypto.randomUUID();
      return memoryDeviceId;
    }
    memorySessionId ??= crypto.randomUUID();
    return memorySessionId;
  }
}
