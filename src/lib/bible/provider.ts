import type {
  BibleError,
  BibleErrorCode,
  TranslationProvider,
} from "./types";

export class BibleProviderError extends Error {
  readonly bibleError: BibleError;

  constructor(
    code: BibleErrorCode,
    message: string,
    provider: TranslationProvider,
    retryable: boolean,
  ) {
    super(message);
    this.name = "BibleProviderError";
    this.bibleError = { code, message, provider, retryable };
  }
}

export function providerError(
  error: unknown,
  provider: TranslationProvider,
): BibleError {
  if (error instanceof BibleProviderError) {
    return error.bibleError;
  }
  return {
    code: "upstream-unavailable",
    message: error instanceof Error ? error.message : "Provider request failed",
    provider,
    retryable: true,
  };
}

export function responseError(
  response: Response,
  provider: TranslationProvider,
): BibleProviderError {
  if (response.status === 401 || response.status === 403) {
    return new BibleProviderError(
      "unauthorized",
      `${provider} rejected its credentials`,
      provider,
      false,
    );
  }
  if (response.status === 429) {
    return new BibleProviderError(
      "rate-limited",
      `${provider} rate limit exceeded`,
      provider,
      true,
    );
  }
  return new BibleProviderError(
    "upstream-unavailable",
    `${provider} returned HTTP ${response.status}`,
    provider,
    response.status >= 500,
  );
}
