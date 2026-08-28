# Side-by-Side Bible

A verse-aligned Bible comparison reader built with Next.js and TypeScript. It supports NASB, NKJV, NIV, the Recovery Version, ESV, and one Original selection that displays the Open Scriptures Hebrew Bible in the Old Testament and the Open Greek New Testament in the New Testament.

## Setup

Requirements:

- Node.js 22 or newer
- npm
- Git submodules initialized
- Credentials for the English translation providers

```sh
git submodule update --init --recursive
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Original-language chapter files are generated before every production build. Generate them manually with:

```sh
npm run generate:data
```

## Environment

`API_BIBLE_KEY` is required for NASB, NKJV, and NIV. The default Bible IDs in `.env.example` were verified against the current account and can be overridden when a licensed edition changes.

`ESV_API_KEY` is required for ESV.

The Recovery Version API uses HTTP Basic authentication. Set `LSM_APP_ID` and `LSM_API_TOKEN`. A combined `LSM_API_KEY=appid:token` value is also accepted for compatibility.

All credentials remain on the server. The browser calls only the application’s chapter and FUMS routes.

## Architecture

- `src/lib/bible/canon.ts` defines the 66-book canon, navigation, and translation metadata.
- `src/lib/bible/providers` isolates API.Bible, ESV, LSM, and generated original-language formats.
- `src/lib/bible/service.ts` validates requests, calls provider groups concurrently, and aligns results into canonical verse rows.
- `src/app/api/bible/chapter/route.ts` exposes one validated, chapter-scoped browser API.
- `scripts/build-original-texts.ts` converts the OSHB XML and OGNT base-text archive into server-only chapter JSON.
- `src/components/reader.tsx` keeps book, chapter, and versions in the URL while storing only preferences and anonymous reporting IDs in browser storage.

Provider failures are isolated to their columns. Hebrew uses the WLC-to-KJV verse map where numbering differs, and merged verse mappings use table row spans so later verses stay aligned.

## Caching and provider limits

- API.Bible chapters use a 14-day process-local cache. FUMS v3 data is retained and reported every time text is displayed, including from cache.
- ESV uses a one-day weighted LRU cache capped at 500 verses.
- Recovery Version responses are never durably cached and are returned to the browser with `no-store`.
- Original-language Hebrew and Greek texts are immutable generated build assets selected automatically by testament.
- The browser keeps at most three recent chapter responses in memory and never writes Scripture text to local storage, session storage, or an offline cache.

The application has no export, bulk-download, or offline-reading feature. Any text rendered by a website necessarily reaches the browser, so the application cannot prevent copying or network inspection of displayed verses.

## Licensing

- NASB, NKJV, and NIV are supplied through API.Bible and require account entitlement, attribution, and FUMS reporting.
- ESV is supplied through Crossway’s ESV API and is subject to its query, quotation, and 500-verse storage limits.
- Recovery Version text is supplied at request time by Living Stream Ministry. Its returned copyright statement is displayed, and its text is not stored for offline use.
- Open Scriptures Hebrew Bible is based on the public-domain Westminster Leningrad Codex and licensed CC BY 4.0 with attribution.
- Open Greek New Testament is licensed CC BY-SA 4.0 with attribution.

Commercial NIV use requires separate permission from Biblica. Before public deployment, review the signed API.Bible/ABS agreement directly; text extraction from the PDFs in this repository is not sufficient legal verification.

## Quality checks

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Browser tests mock provider responses and do not consume external API quotas.
