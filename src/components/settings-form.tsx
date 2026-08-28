"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  BIBLE_BOOKS,
  MAX_SELECTED_VERSIONS,
  TRANSLATIONS,
  getBook,
  isBookId,
} from "@/lib/bible/canon";
import type { BookId, TranslationId } from "@/lib/bible/types";
import {
  loadPreferences,
  savePreferences,
  type ReaderPreferences,
} from "@/lib/preferences";

export function SettingsForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [preferences, setPreferences] = useState<ReaderPreferences>();

  useEffect(() => {
    queueMicrotask(() => setPreferences(loadPreferences(window.localStorage)));
  }, []);

  if (!preferences) {
    return (
      <div className="settings-loading" role="status">
        Loading preferences…
      </div>
    );
  }

  const toggleVersion = (id: TranslationId) => {
    setPreferences((current) => {
      if (!current) {
        return current;
      }
      const selected = current.versions.includes(id);
      if (!selected && current.versions.length >= MAX_SELECTED_VERSIONS) {
        return current;
      }
      return {
        ...current,
        versions: selected
          ? current.versions.filter((version) => version !== id)
          : [...current.versions, id],
      };
    });
  };
  const toggleBook = (id: BookId) => {
    setPreferences((current) => {
      if (!current) {
        return current;
      }
      const selected = new Set(current.books);
      if (selected.has(id)) {
        selected.delete(id);
      } else {
        selected.add(id);
      }
      return {
        ...current,
        books: BIBLE_BOOKS.filter((book) => selected.has(book.id)).map(
          (book) => book.id,
        ),
      };
    });
  };
  const valid =
    preferences.versions.length >= 1 &&
    preferences.versions.length <= MAX_SELECTED_VERSIONS &&
    preferences.books.length >= 1;

  return (
    <form
      className="settings-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) {
          return;
        }
        const saved = savePreferences(window.localStorage, preferences);
        router.push(destination(searchParams.get("returnTo"), saved));
      }}
    >
      <section className="settings-section" aria-labelledby="versions-heading">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Columns</span>
            <h2 id="versions-heading">Translations</h2>
          </div>
          <span className="selection-count">
            {preferences.versions.length} / {MAX_SELECTED_VERSIONS}
          </span>
        </div>
        <p className="section-description">
          Choose one to five translations. Their order follows this list.
        </p>
        <div className="translation-options">
          {TRANSLATIONS.map((translation) => {
            const checked = preferences.versions.includes(translation.id);
            const scope =
              translation.id === "original"
                ? "Hebrew (OT) / Greek (NT)"
                : "Old & New Testaments";
            return (
              <label className="choice-card" key={translation.id}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={
                    !checked &&
                    preferences.versions.length >= MAX_SELECTED_VERSIONS
                  }
                  onChange={() => toggleVersion(translation.id)}
                />
                <span className="choice-copy">
                  <span>
                    <strong>{translation.abbreviation}</strong>
                    <span>{translation.name}</span>
                  </span>
                  <small>{scope}</small>
                </span>
              </label>
            );
          })}
        </div>
        {preferences.versions.length === 0 ? (
          <p className="validation-message" role="alert">
            Select at least one translation.
          </p>
        ) : null}
      </section>

      <section className="settings-section" aria-labelledby="books-heading">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Navigation</span>
            <h2 id="books-heading">Canonical books</h2>
          </div>
          <span className="selection-count">
            {preferences.books.length} / {BIBLE_BOOKS.length}
          </span>
        </div>
        <p className="section-description">
          Show only the books you want in the reader’s book selector.
        </p>
        <div className="book-helpers" aria-label="Book selection shortcuts">
          <button
            className="button button-secondary"
            type="button"
            onClick={() =>
              setPreferences({
                ...preferences,
                books: BIBLE_BOOKS.map(({ id }) => id),
              })
            }
          >
            All books
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={() =>
              setPreferences({
                ...preferences,
                books: BIBLE_BOOKS.filter(
                  ({ testament }) => testament === "old",
                ).map(({ id }) => id),
              })
            }
          >
            Old Testament
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={() =>
              setPreferences({
                ...preferences,
                books: BIBLE_BOOKS.filter(
                  ({ testament }) => testament === "new",
                ).map(({ id }) => id),
              })
            }
          >
            New Testament
          </button>
        </div>
        {(["old", "new"] as const).map((testament) => (
          <fieldset className="book-group" key={testament}>
            <legend>
              {testament === "old" ? "Old Testament" : "New Testament"}
            </legend>
            <div className="book-options">
              {BIBLE_BOOKS.filter((book) => book.testament === testament).map(
                (book) => (
                  <label key={book.id}>
                    <input
                      type="checkbox"
                      checked={preferences.books.includes(book.id)}
                      onChange={() => toggleBook(book.id)}
                    />
                    <span>{book.name}</span>
                  </label>
                ),
              )}
            </div>
          </fieldset>
        ))}
        {preferences.books.length === 0 ? (
          <p className="validation-message" role="alert">
            Keep at least one canonical book in navigation.
          </p>
        ) : null}
      </section>

      <div className="settings-actions">
        <button
          className="button button-primary"
          type="submit"
          disabled={!valid}
        >
          Save and return to reader
        </button>
        <Link className="button button-secondary" href="/read/JHN/1">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function destination(
  returnTo: string | null,
  preferences: ReaderPreferences,
): string {
  let book = preferences.books[0];
  let chapter = 1;
  if (returnTo) {
    try {
      const url = new URL(returnTo, "https://reader.invalid");
      const match = /^\/read\/([^/]+)\/(\d+)$/u.exec(url.pathname);
      const candidate = match?.[1]?.toUpperCase() ?? "";
      const candidateChapter = Number(match?.[2]);
      if (
        isBookId(candidate) &&
        preferences.books.includes(candidate) &&
        Number.isInteger(candidateChapter) &&
        candidateChapter >= 1 &&
        candidateChapter <= getBook(candidate).chapters
      ) {
        book = candidate;
        chapter = candidateChapter;
      }
    } catch {
      book = preferences.books[0];
    }
  }
  return `/read/${book}/${chapter}?versions=${preferences.versions.join(",")}`;
}
