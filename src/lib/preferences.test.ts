import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  loadPreferences,
  parseVersionsParam,
  savePreferences,
  validateBooks,
  validatePreferences,
  validateVersions,
} from "./preferences";

describe("reader preferences", () => {
  it("validates and normalizes versions", () => {
    expect(validateVersions(["ESV", "greek"])).toEqual(["esv", "original"]);
    expect(parseVersionsParam("esv, nasb")).toEqual(["esv", "nasb"]);
    expect(
      parseVersionsParam("hebrew, esv, greek, original, nasb"),
    ).toEqual(["original", "esv", "nasb"]);
    expect(validateVersions([])).toBeUndefined();
    expect(validateVersions(["esv", "esv"])).toEqual(["esv"]);
    expect(validateVersions(["esv", "unknown"])).toBeUndefined();
    expect(
      validateVersions([
        "esv",
        "nasb",
        "nkjv",
        "niv",
        "rcv",
        "hebrew",
        "greek",
      ]),
    ).toBeUndefined();
  });

  it("validates books and restores canonical ordering", () => {
    expect(validateBooks(["JHN", "GEN"])).toEqual(["GEN", "JHN"]);
    expect(validateBooks([])).toBeUndefined();
    expect(validateBooks(["JHN", "JHN"])).toBeUndefined();
    expect(validateBooks(["BAD"])).toBeUndefined();
  });

  it("rejects partially valid preference objects", () => {
    expect(
      validatePreferences({ versions: ["esv"], books: ["JHN"] }),
    ).toEqual({ versions: ["esv"], books: ["JHN"] });
    expect(
      validatePreferences({ versions: [], books: ["JHN"] }),
    ).toBeUndefined();
    expect(
      validatePreferences({ versions: ["esv"], books: [] }),
    ).toBeUndefined();
  });

  it("loads defaults for missing, malformed, or invalid storage", () => {
    expect(loadPreferences({ getItem: () => null })).toEqual(DEFAULT_PREFERENCES);
    expect(loadPreferences({ getItem: () => "{" })).toEqual(DEFAULT_PREFERENCES);
    expect(
      loadPreferences({
        getItem: () => JSON.stringify({ versions: [], books: ["GEN"] }),
      }),
    ).toEqual(DEFAULT_PREFERENCES);
  });

  it("persists only validated preferences", () => {
    const setItem = vi.fn();
    const preferences = { versions: ["original"] as const, books: ["JHN"] as const };

    savePreferences({ setItem }, {
      versions: [...preferences.versions],
      books: [...preferences.books],
    });

    expect(setItem).toHaveBeenCalledWith(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ versions: ["original"], books: ["JHN"] }),
    );
    expect(() =>
      savePreferences({ setItem }, { versions: [], books: ["JHN"] }),
    ).toThrow(TypeError);
  });

  it("migrates legacy stored versions and writes the canonical value", () => {
    const setItem = vi.fn();
    const storage = {
      getItem: () =>
        JSON.stringify({
          versions: ["esv", "hebrew", "greek", "original", "nasb"],
          books: ["JHN"],
        }),
      setItem,
    };

    expect(loadPreferences(storage)).toEqual({
      versions: ["esv", "original", "nasb"],
      books: ["JHN"],
    });
    expect(setItem).toHaveBeenCalledWith(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        versions: ["esv", "original", "nasb"],
        books: ["JHN"],
      }),
    );
  });
});
