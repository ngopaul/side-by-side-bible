"use client";

import { useEffect, useRef, useState } from "react";

import {
  sliceChapterRows,
  type ChapterSectionRange,
} from "@/lib/bible/chapter-sections";
import type {
  ChapterCell,
  ChapterMatrix,
  ChapterVersion,
  TranslationId,
  VerseAnnotation,
} from "@/lib/bible/types";

interface ScriptureGridProps {
  matrix?: ChapterMatrix;
  loading: boolean;
  requestedVersions: readonly TranslationId[];
  activePart: number;
  ranges: readonly ChapterSectionRange[];
  onPartChange: (part: number) => void;
  onRetry: () => void;
}

export function ScriptureGrid({
  matrix,
  loading,
  requestedVersions,
  activePart,
  ranges,
  onPartChange,
  onRetry,
}: ScriptureGridProps) {
  const headerRef = useRef<HTMLTableSectionElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickyTrackRef = useRef<HTMLDivElement>(null);
  const previousPartRef = useRef(activePart);
  const renderedMatrixRef = useRef<ChapterMatrix | undefined>(undefined);
  const [showStickyVersions, setShowStickyVersions] = useState(false);
  const [openAnnotation, setOpenAnnotation] = useState<string>();

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

  useEffect(() => {
    if (!matrix) {
      renderedMatrixRef.current = undefined;
      previousPartRef.current = activePart;
      return;
    }
    if (renderedMatrixRef.current !== matrix) {
      renderedMatrixRef.current = matrix;
      previousPartRef.current = activePart;
      return;
    }
    if (previousPartRef.current === activePart) {
      return;
    }
    previousPartRef.current = activePart;
    setOpenAnnotation(undefined);
    setShowStickyVersions(false);
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }
    if (stickyTrackRef.current) {
      stickyTrackRef.current.style.transform = "translateX(0px)";
    }
    const frame = window.requestAnimationFrame(() => {
      const header = headerRef.current;
      if (!header) {
        return;
      }
      const toolbarBottom =
        document.querySelector<HTMLElement>(".reader-toolbar")
          ?.getBoundingClientRect().bottom ?? 0;
      window.scrollTo({
        top: Math.max(
          0,
          window.scrollY +
            header.getBoundingClientRect().top -
            toolbarBottom -
            1,
        ),
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activePart, matrix]);

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
  const activeRange = ranges[activePart - 1];
  const visibleRows = activeRange
    ? sliceChapterRows(matrix.rows, activeRange)
    : [];
  const previousRange = ranges[activePart - 2];
  const nextRange = ranges[activePart];

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
        ref={scrollRef}
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
            {previousRange ? (
              <SectionControlRow
                colSpan={matrix.versions.length + 1}
                destinationPart={activePart - 1}
                direction="previous"
                label={rangeLabel(matrix, previousRange)}
                onPartChange={onPartChange}
                position="top"
              />
            ) : null}
            {visibleRows.map((row) => (
              <tr key={row.verse} data-testid={`verse-row-${row.verse}`}>
                <th className="verse-number" scope="row">
                  {row.verse}
                </th>
                {matrix.versions.map((version) => (
                  <VerseCell
                    key={version.translation.id}
                    annotation={row.annotations?.[version.translation.id]}
                    annotationId={`${matrix.reference.book}-${matrix.reference.chapter}-part-${activePart}-${version.translation.id}-${row.verse}`}
                    cells={row.cells[version.translation.id]}
                    direction={version.translation.direction}
                    language={version.translation.language}
                    hasError={Boolean(version.error)}
                    isAnnotationOpen={
                      openAnnotation ===
                      `${matrix.reference.book}-${matrix.reference.chapter}-part-${activePart}-${version.translation.id}-${row.verse}`
                    }
                    onCloseAnnotation={() => setOpenAnnotation(undefined)}
                    onToggleAnnotation={() =>
                      setOpenAnnotation((current) =>
                        current ===
                        `${matrix.reference.book}-${matrix.reference.chapter}-part-${activePart}-${version.translation.id}-${row.verse}`
                          ? undefined
                          : `${matrix.reference.book}-${matrix.reference.chapter}-part-${activePart}-${version.translation.id}-${row.verse}`,
                      )
                    }
                  />
                ))}
              </tr>
            ))}
            {nextRange ? (
              <SectionControlRow
                colSpan={matrix.versions.length + 1}
                destinationPart={activePart + 1}
                direction="next"
                label={rangeLabel(matrix, nextRange)}
                onPartChange={onPartChange}
                position="bottom"
              />
            ) : null}
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

function SectionControlRow({
  colSpan,
  destinationPart,
  direction,
  label,
  onPartChange,
  position,
}: {
  colSpan: number;
  destinationPart: number;
  direction: "previous" | "next";
  label: string;
  onPartChange: (part: number) => void;
  position: "top" | "bottom";
}) {
  const action = direction === "previous" ? "Previous section" : "Next section";
  return (
    <tr
      className={`section-control-row section-control-${position}`}
      data-testid={`${position}-section-control`}
    >
      <td className="section-control-cell" colSpan={colSpan}>
        <button
          className="section-control-button"
          type="button"
          onClick={() => onPartChange(destinationPart)}
        >
          {direction === "previous" ? <span aria-hidden="true">←</span> : null}
          <span>{action} · {label}</span>
          {direction === "next" ? <span aria-hidden="true">→</span> : null}
        </button>
      </td>
    </tr>
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
  annotation,
  annotationId,
  cells,
  direction,
  language,
  hasError,
  isAnnotationOpen,
  onCloseAnnotation,
  onToggleAnnotation,
}: {
  annotation: VerseAnnotation | undefined;
  annotationId: string;
  cells: readonly ChapterCell[] | undefined;
  direction: "ltr" | "rtl";
  language: "English" | "Hebrew" | "Greek" | "Original";
  hasError: boolean;
  isAnnotationOpen: boolean;
  onCloseAnnotation: () => void;
  onToggleAnnotation: () => void;
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
      {visibleCells.map((cell, index) =>
        cell.continuation ? (
          <span
            aria-label="Text continues from previous section"
            className="continuation-placeholder"
            key={`${cell.canonicalSlots.map(({ verse }) => verse).join("-")}-${index}`}
          >
            Continued
          </span>
        ) : (
          <p
            className="verse-text"
            key={`${cell.canonicalSlots.map(({ verse }) => verse).join("-")}-${index}`}
            title={sourceLabel(cell)}
          >
            {cell.lines
              ? cell.lines.map((line, lineIndex) => (
                  <span
                    className={`poetry-line poetry-${line.style}`}
                    key={lineIndex}
                  >
                    {line.text}
                  </span>
                ))
              : cell.text}
          </p>
        ),
      )}
      {!hasError && visibleCells.length > 0 && annotation ? (
        <OmissionNote
          annotation={annotation}
          annotationId={annotationId}
          className="included-omission-note"
          isOpen={isAnnotationOpen}
          label="Why this verse has a manuscript note"
          onClose={onCloseAnnotation}
          onToggle={onToggleAnnotation}
        />
      ) : null}
      {!hasError && visibleCells.length === 0 && annotation ? (
        <OmissionReading
          annotation={annotation}
          annotationId={annotationId}
          isOpen={isAnnotationOpen}
          onClose={onCloseAnnotation}
          onToggle={onToggleAnnotation}
        />
      ) : null}
      {!hasError && visibleCells.length === 0 && !annotation ? (
        <span className="missing-verse" aria-label="No corresponding verse">
          —
        </span>
      ) : null}
    </td>
  );
}

function OmissionReading({
  annotation,
  annotationId,
  isOpen,
  onClose,
  onToggle,
}: {
  annotation: VerseAnnotation;
  annotationId: string;
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
}) {
  return (
    <span
      className="omission-reading"
      dir={annotation.direction}
      lang={annotation.language === "Hebrew" ? "he" : "el"}
    >
      <span className="verse-text alternate-verse-text">
        {annotation.alternateText}
      </span>
      <span className="omission-source">
        <a href={annotation.sourceUrl} rel="noreferrer" target="_blank">
          {annotation.sourceLabel}
        </a>
        <OmissionNote
          annotation={annotation}
          annotationId={annotationId}
          isOpen={isOpen}
          label={`Why this alternate ${annotation.language} text is shown`}
          onClose={onClose}
          onToggle={onToggle}
        />
      </span>
    </span>
  );
}

function OmissionNote({
  annotation,
  annotationId,
  className,
  isOpen,
  label,
  onClose,
  onToggle,
}: {
  annotation: VerseAnnotation;
  annotationId: string;
  className?: string;
  isOpen: boolean;
  label: string;
  onClose: () => void;
  onToggle: () => void;
}) {
  const tooltipId = `omission-note-${annotationId}`;
  return (
    <span
      className={`omission-note ${className ?? ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onClose();
        }
      }}
    >
      <button
        type="button"
        className="omission-note-button"
        aria-expanded={isOpen}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-label={label}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onClose();
          }
        }}
      >
        *
      </button>
      {isOpen ? (
        <span className="omission-tooltip" id={tooltipId} role="tooltip">
          <span>{annotation.explanation}</span>
          <span>{annotation.provenance}</span>
        </span>
      ) : null}
    </span>
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

function rangeLabel(
  matrix: ChapterMatrix,
  range: ChapterSectionRange,
): string {
  const first = matrix.rows[range.start]?.verse;
  const last = matrix.rows[range.end - 1]?.verse;
  return first === last ? `Verse ${first}` : `Verses ${first}–${last}`;
}
