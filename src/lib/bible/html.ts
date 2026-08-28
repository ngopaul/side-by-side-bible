const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  nbsp: "\u00a0",
  ndash: "–",
  quot: '"',
  rdquo: "”",
  rsquo: "’",
};

export function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x[\da-f]+|#\d+|[a-z][\da-z]+);/giu,
    (entity, code: string) => {
      if (code.startsWith("#x")) {
        return codePoint(Number.parseInt(code.slice(2), 16), entity);
      }
      if (code.startsWith("#")) {
        return codePoint(Number.parseInt(code.slice(1), 10), entity);
      }
      return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
    },
  );
}

export function htmlToText(value: string): string {
  const withoutUnsafeMarkup = value
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/giu, "")
    .replace(/<(br|hr)\b[^>]*\/?>/giu, " ")
    .replace(/<\/(div|p|li|q|blockquote)>/giu, " ")
    .replace(/<[^>]*>/gu, "");
  return decodeHtmlEntities(withoutUnsafeMarkup)
    .replace(/\u00a0/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function codePoint(value: number, fallback: string): string {
  if (!Number.isInteger(value) || value < 0 || value > 0x10ffff) {
    return fallback;
  }
  return String.fromCodePoint(value);
}
