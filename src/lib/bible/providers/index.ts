import "server-only";

import type {
  BibleProvider,
  NormalizedChapter,
  TranslationProvider,
} from "../types";
import { ApiBibleProvider } from "./api-bible";
import { EsvProvider } from "./esv";
import { LsmProvider } from "./lsm";
import { OriginalTextProvider } from "./original";

export function createBibleProviders(): BibleProvider[] {
  return [
    captureProvider("api-bible", () => ApiBibleProvider.fromEnvironment()),
    captureProvider("esv", () => EsvProvider.fromEnvironment()),
    captureProvider("lsm", () => LsmProvider.fromEnvironment()),
    new OriginalTextProvider(),
  ];
}

function captureProvider(
  id: TranslationProvider,
  create: () => BibleProvider,
): BibleProvider {
  try {
    return create();
  } catch (error) {
    return new FailedProvider(id, error);
  }
}

class FailedProvider implements BibleProvider {
  constructor(
    readonly id: TranslationProvider,
    private readonly error: unknown,
  ) {}

  getChapter(): Promise<readonly NormalizedChapter[]> {
    return Promise.reject(this.error);
  }
}
