"use client";

import { useEffect, useRef, useState } from "react";

import type {
  ChapterCell,
  ChapterMatrix,
  ChapterVersion,
  TranslationId,
} from "@/lib/bible/types";

interface ScriptureGridProps {
  matrix?: ChapterMatrix;
  loading: boolean;
  requestedVersions: readonly TranslationId[];
  onRetry: () => void;
}

export function ScriptureGrid({
  matrix,
  loading,
  requestedVersions,
  onRetry,
}: ScriptureGridProps) {
  const headerRef = useRef<HTMLTableSectionElement>(null);
  const stickyTrackRef = useRef<HTMLDivElement>(null);
  const [showStickyVersions, setShowStickyVersions] = useState(false);

  useEffect(() => {
    const header = headerRef.current;
    if (!header || !matrix) {
      setShowStickyVersions(false);
      return;
    }
    const toolbarBottom =
      document.querySelector<HTMLElement>(".reader-toolbar")
        ?.getBoundingClientRect().bottom ?? 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyVersions(
          !entry.isIntersecting &&
            entry.boundingClientRect.bottom <= toolbarBottom,
        );
      },
      { rootMargin: `-${Math.ceil(toolbarBottom)}px 0px 0px 0px` },
    );
    observer.observe(header);
    return () => observer.disconnect();
  }, [matrix]);

  if (loading && !matrix) {
    return <ReaderSkeleton columns={requestedVersions.length} />;
  }
  if (!matrix) {
    return (
      <section className="reader-empty" role="alert">
        <h2>We couldn’t load this chapter.</h2>
        <p>Check your connection, then try again.</p>
        <button className="button button-primary" type="button" onClick={onRetry}>
          Retry
        </button>
      </section>
    );
  }

  const columnStyle = {
    "--reader-columns": matrix.versions.length,
  } as React.CSSProperties;
  const hasReadableColumn = matrix.versions.some((version) => !version.error);

  return (
    <section
      className="scripture-region"
      aria-busy={loading}
      aria-label={`${matrix.reference.book} chapter ${matrix.reference.chapter} comparison`}
    >
      {loading ? <div className="loading-line" aria-label="Loading chapter" /> : null}
      <div
        className={`sticky-version-bar ${showStickyVersions ? "visible" : ""}`}
        aria-hidden="true"
        data-testid="sticky-version-bar"
      >
        <div className="sticky-version-viewport">
          <div
            className="sticky-version-track"
            data-testid="sticky-version-track"
            ref={stickyTrackRef}
            style={columnStyle}
          >
            <span className="sticky-verse-gutter" />
            {matrix.versions.map((version) => (
              <span
                className="sticky-version-label"
                dir={version.translation.direction}
                key={version.translation.id}
              >
                <strong>{version.translation.abbreviation}</strong>
                <span>{version.translation.name}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div
        className="scripture-scroll"
        data-testid="scripture-scroll"
        onScroll={(event) => {
          if (stickyTrackRef.current) {
            stickyTrackRef.current.style.transform =
              `translateX(${-event.currentTarget.scrollLeft}px)`;
          }
        }}
      >
        <table className="scripture-table" style={columnStyle}>
          <caption className="sr-only">
            Bible translations aligned by canonical verse
          </caption>
          <thead ref={headerRef}>
            <tr>
              <th className="verse-heading" scope="col">
                <span className="sr-only">Verse</span>
              </th>
              {matrix.versions.map((version) => (
                <VersionHeading
                  key={version.translation.id}
                  version={version}
                  onRetry={onRetry}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.verse} data-testid={`verse-row-${row.verse}`}>
                <th className="verse-number" scope="row">
                  {row.verse}
                </th>
                {matrix.versions.map((version) => (
                  <VerseCell
                    key={version.translation.id}
                    cells={row.cells[version.translation.id]}
                    direction={version.translation.direction}
                    language={version.translation.language}
                    hasError={Boolean(version.error)}
                  />
                ))}
              </tr>
            ))}
            {!hasReadableColumn || matrix.rows.length === 0 ? (
              <tr>
                <th className="verse-number" scope="row">
                  <span className="sr-only">Status</span>
                </th>
                {matrix.versions.map((version) => (
                  <td className="empty-column" key={version.translation.id}>
                    {version.error ? (
                      <>
                        <p>{version.error.message}</p>
                        {version.error.retryable ? (
                          <button
                            className="text-button"
                            type="button"
                            onClick={onRetry}
                          >
                            Retry {version.translation.abbreviation}
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <p>No verses were returned for this translation.</p>
                    )}
                  </td>
                ))}
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr>
              <th className="verse-number" scope="row">
                <span className="sr-only">Attribution</span>
              </th>
              {matrix.versions.map((version) => (
                <td className="attribution" key={version.translation.id}>
                  <Attribution version={version} />
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function VersionHeading({
  version,
  onRetry,
}: {
  version: ChapterVersion;
  onRetry: () => void;
}) {
  return (
    <th
      className="version-heading"
      scope="col"
      dir={version.translation.direction}
      data-translation={version.translation.id}
    >
      <span className="version-abbreviation">
        {version.translation.abbreviation}
      </span>
      <span className="version-name">{version.translation.name}</span>
      {version.error ? (
        <span className="column-error" role="status">
          <span>{version.error.message}</span>
          {version.error.retryable ? (
            <button className="text-button" type="button" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </span>
      ) : null}
    </th>
  );
}

function VerseCell({
  cells,
  direction,
  language,
  hasError,
}: {
  cells: readonly ChapterCell[] | undefined;
  direction: "ltr" | "rtl";
  language: "English" | "Hebrew" | "Greek" | "Original";
  hasError: boolean;
}) {
  if (cells?.length && cells.every((cell) => !cell.display)) {
    return null;
  }
  const visibleCells = cells?.filter((cell) => cell.display) ?? [];
  const rowSpan = Math.max(1, ...visibleCells.map((cell) => cell.rowSpan));
  return (
    <td
      className={`scripture-cell ${language === "Hebrew" ? "hebrew-text" : ""}`}
      dir={direction}
      lang={language === "Hebrew" ? "he" : language === "Greek" ? "el" : "en"}
      rowSpan={rowSpan}
    >
      {visibleCells.map((cell, index) => (
        <p
          className="verse-text"
          key={`${cell.canonicalSlots.map(({ verse }) => verse).join("-")}-${index}`}
          title={sourceLabel(cell)}
        >
          {cell.text}
        </p>
      ))}
      {!hasError && visibleCells.length === 0 ? (
        <span className="missing-verse" aria-label="No corresponding verse">
          —
        </span>
      ) : null}
    </td>
  );
}

function Attribution({ version }: { version: ChapterVersion }) {
  if (!version.attribution) {
    return (
      <span>
        {version.error
          ? "Text unavailable; no content displayed."
          : "No attribution was provided."}
      </span>
    );
  }
  const content = (
    <>
      <strong>{version.attribution.label}</strong>
      <span>{version.attribution.text}</span>
      {version.attribution.license ? (
        <span>{version.attribution.license}</span>
      ) : null}
    </>
  );
  return version.attribution.url ? (
    <a href={version.attribution.url} rel="noreferrer" target="_blank">
      {content}
    </a>
  ) : (
    content
  );
}

function ReaderSkeleton({ columns }: { columns: number }) {
  const columnStyle = {
    "--reader-columns": columns,
  } as React.CSSProperties;
  return (
    <section className="scripture-region" aria-label="Loading chapter">
      <div className="scripture-scroll">
        <div className="skeleton-grid" style={columnStyle}>
          {Array.from({ length: Math.max(1, columns * 8) }, (_, index) => (
            <span className="skeleton-block" key={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

function sourceLabel(cell: ChapterCell): string {
  return cell.sourceReferences
    .map(({ book, chapter, verse, part }) =>
      `${book} ${chapter}:${verse}${part ?? ""}`,
    )
    .join(", ");
}
