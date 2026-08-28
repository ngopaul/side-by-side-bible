import {
  BIBLE_BOOKS,
  normalizeTranslationIds,
} from "@/lib/bible/canon";
import type { BookId, TranslationId } from "@/lib/bible/types";

export const PREFERENCES_STORAGE_KEY = "side-by-side-bible.preferences.v1";

export interface ReaderPreferences {
  versions: TranslationId[];
  books: BookId[];
}

export const DEFAULT_PREFERENCES: ReaderPreferences = {
  versions: ["esv", "nasb"],
  books: BIBLE_BOOKS.map(({ id }) => id),
};

const bookIds = new Set<string>(BIBLE_BOOKS.map(({ id }) => id));

export function validateVersions(value: unknown): TranslationId[] | undefined {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.some((entry) => typeof entry !== "string")
  ) {
    return undefined;
  }
  return normalizeTranslationIds(value);
}

export function parseVersionsParam(value: string | null): TranslationId[] | undefined {
  if (!value) {
    return undefined;
  }
  return validateVersions(value.split(",").map((entry) => entry.trim()));
}

export function validateBooks(value: unknown): BookId[] | undefined {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.some((entry) => typeof entry !== "string")
  ) {
    return undefined;
  }
  const normalized = value.map((entry) => entry.toUpperCase());
  if (
    new Set(normalized).size !== normalized.length ||
    normalized.some((entry) => !bookIds.has(entry))
  ) {
    return undefined;
  }
  const selected = new Set(normalized);
  return BIBLE_BOOKS.filter(({ id }) => selected.has(id)).map(({ id }) => id);
}

export function validatePreferences(value: unknown): ReaderPreferences | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const versions = validateVersions(record.versions);
  const books = validateBooks(record.books);
  return versions && books ? { versions, books } : undefined;
}

export function loadPreferences(
  storage: Pick<Storage, "getItem"> & Partial<Pick<Storage, "setItem">>,
): ReaderPreferences {
  try {
    const stored = storage.getItem(PREFERENCES_STORAGE_KEY);
    if (!stored) {
      return cloneDefaults();
    }
    const preferences = validatePreferences(JSON.parse(stored));
    if (!preferences) {
      return cloneDefaults();
    }
    const serialized = JSON.stringify(preferences);
    if (serialized !== stored) {
      storage.setItem?.(PREFERENCES_STORAGE_KEY, serialized);
    }
    return preferences;
  } catch {
    return cloneDefaults();
  }
}

export function savePreferences(
  storage: Pick<Storage, "setItem">,
  preferences: ReaderPreferences,
): ReaderPreferences {
  const validated = validatePreferences(preferences);
  if (!validated) {
    throw new TypeError("Preferences require 1–5 versions and at least one book");
  }
  storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(validated));
  return validated;
}

function cloneDefaults(): ReaderPreferences {
  return {
    versions: [...DEFAULT_PREFERENCES.versions],
    books: [...DEFAULT_PREFERENCES.books],
  };
}
