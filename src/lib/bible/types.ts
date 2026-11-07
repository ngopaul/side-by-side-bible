export type Testament = "old" | "new";

export type BookId =
  | "GEN"
  | "EXO"
  | "LEV"
  | "NUM"
  | "DEU"
  | "JOS"
  | "JDG"
  | "RUT"
  | "1SA"
  | "2SA"
  | "1KI"
  | "2KI"
  | "1CH"
  | "2CH"
  | "EZR"
  | "NEH"
  | "EST"
  | "JOB"
  | "PSA"
  | "PRO"
  | "ECC"
  | "SNG"
  | "ISA"
  | "JER"
  | "LAM"
  | "EZK"
  | "DAN"
  | "HOS"
  | "JOL"
  | "AMO"
  | "OBA"
  | "JON"
  | "MIC"
  | "NAM"
  | "HAB"
  | "ZEP"
  | "HAG"
  | "ZEC"
  | "MAL"
  | "MAT"
  | "MRK"
  | "LUK"
  | "JHN"
  | "ACT"
  | "ROM"
  | "1CO"
  | "2CO"
  | "GAL"
  | "EPH"
  | "PHP"
  | "COL"
  | "1TH"
  | "2TH"
  | "1TI"
  | "2TI"
  | "TIT"
  | "PHM"
  | "HEB"
  | "JAS"
  | "1PE"
  | "2PE"
  | "1JN"
  | "2JN"
  | "3JN"
  | "JUD"
  | "REV";

export interface BibleBook {
  id: BookId;
  osisId: string;
  apiBibleId: string;
  name: string;
  testament: Testament;
  chapters: number;
}

export interface ChapterReference {
  book: BookId;
  chapter: number;
}

export interface VerseReference extends ChapterReference {
  verse: number;
}

export interface SourceReference {
  source: string;
  book: string;
  chapter: number;
  verse: number;
  part?: string;
}

export type VerseMappingKind =
  | "one-to-one"
  | "one-to-many"
  | "many-to-one"
  | "many-to-many";

export interface VerseMapping {
  sourceReferences: readonly SourceReference[];
  canonicalSlots: readonly VerseReference[];
  kind: VerseMappingKind;
}

export type TranslationId =
  | "nasb"
  | "nkjv"
  | "niv"
  | "rcv"
  | "esv"
  | "original";

export type OriginalTextSourceId = "hebrew" | "greek";

export type TranslationProvider =
  | "api-bible"
  | "esv"
  | "lsm"
  | "original";

export interface TranslationProfile {
  approach: string;
  publication: string;
  description: string;
  infoLinks: readonly {
    label: string;
    url: string;
  }[];
}

export interface TranslationMetadata {
  id: TranslationId;
  abbreviation: string;
  name: string;
  language: "English" | "Hebrew" | "Greek" | "Original";
  provider: TranslationProvider;
  availability: readonly Testament[];
  direction: "ltr" | "rtl";
  profile: TranslationProfile;
}

export interface Attribution {
  label: string;
  text: string;
  url?: string;
  license?: string;
}

export interface FumsMetadata {
  fums?: string;
  fumsId: string;
  fumsToken?: string;
  fumsJsInclude?: string;
  fumsJs?: string;
  fumsNoScript?: string;
}

export interface FumsReport {
  fumsId: string;
  token: string;
  endpoint: "/api/bible/fums";
}

export interface ManuscriptOmissionAnnotation {
  type: "manuscript-omission";
  alternateText: string;
  language: "Greek" | "Hebrew";
  direction: "ltr" | "rtl";
  sourceLabel: string;
  sourceUrl: string;
  license: string;
  explanation: string;
  provenance: string;
}

export type VerseAnnotation = ManuscriptOmissionAnnotation;

export type BibleErrorCode =
  | "invalid-reference"
  | "translation-unavailable"
  | "unauthorized"
  | "rate-limited"
  | "upstream-unavailable"
  | "invalid-response"
  | "unknown";

export interface BibleError {
  code: BibleErrorCode;
  message: string;
  provider?: TranslationProvider;
  retryable: boolean;
}

export type VerseLineStyle = "p" | "m" | "b" | "q" | "q1" | "q2" | "q3" | "q4";

export interface VerseLine {
  style: VerseLineStyle;
  text: string;
}

export interface NormalizedVerse {
  slots: readonly VerseReference[];
  sourceReferences: readonly SourceReference[];
  text: string;
  lines?: readonly VerseLine[]; // only set when the verse contains poetry
}

export interface NormalizedChapter {
  reference: ChapterReference;
  translation: TranslationId;
  translationMetadata?: TranslationMetadata;
  verses: readonly NormalizedVerse[];
  attribution: Attribution;
  fums?: FumsMetadata;
  error?: BibleError;
  originalSourceOmissions?: Readonly<
    Record<number, ManuscriptOmissionAnnotation>
  >;
}

export interface BibleProviderRequest {
  reference: ChapterReference;
  translations: readonly TranslationId[];
}

export interface BibleProvider {
  readonly id: TranslationProvider;
  getChapter(
    request: BibleProviderRequest,
  ): Promise<readonly NormalizedChapter[]>;
}

export interface ChapterCell {
  translation: TranslationId;
  text: string;
  lines?: readonly VerseLine[];
  sourceReferences: readonly SourceReference[];
  canonicalSlots: readonly VerseReference[];
  display: boolean;
  rowSpan: number;
  continuation?: boolean;
}

export interface ChapterRow {
  verse: number;
  cells: Partial<Record<TranslationId, readonly ChapterCell[]>>;
  annotations?: Partial<Record<TranslationId, VerseAnnotation>>;
}

export interface ChapterVersion {
  translation: TranslationMetadata;
  attribution?: Attribution;
  error?: BibleError;
  fums?: FumsReport;
}

export interface ChapterMatrix {
  reference: ChapterReference;
  versions: readonly ChapterVersion[];
  rows: readonly ChapterRow[];
}
