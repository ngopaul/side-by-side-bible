import { describe, expect, it } from "vitest";

import {
  parseGreekTsv,
  parseHebrewBook,
  parseVerseMap,
} from "./original-texts";

describe("original-language parsing", () => {
  it("preserves Hebrew Unicode and applies full WLC remaps", () => {
    const verseMap = parseVerseMap(
      '<verseMap><verse wlc="Gen.32.1" kjv="Gen.31.55" type="full"/></verseMap>',
    );
    const verses = parseHebrewBook(
      '<osis><verse osisID="Gen.32.1"><w>וַ/יַּשְׁכֵּ֨ם</w><seg type="x-maqqef">־</seg><w>לָבָ֜ן</w><seg type="x-sof-pasuq">׃</seg></verse></osis>',
      verseMap,
    );

    expect(verses).toEqual([
      {
        text: "וַיַּשְׁכֵּ֨ם־לָבָ֜ן׃",
        mapping: {
          sourceReferences: [
            {
              source: "WLC",
              book: "Gen",
              chapter: 32,
              verse: 1,
            },
          ],
          canonicalSlots: [{ book: "GEN", chapter: 31, verse: 55 }],
          kind: "one-to-one",
        },
      },
    ]);
  });

  it("retains multi-slot partial remaps", () => {
    const verseMap = parseVerseMap(
      [
        '<verse wlc="Ps.13.6!a" kjv="Ps.13.5" type="partial"/>',
        '<verse wlc="Ps.13.6!b" kjv="Ps.13.6" type="partial"/>',
      ].join(""),
    );
    const [verse] = parseHebrewBook(
      '<osis><verse osisID="Ps.13.6"><w>אָשִׁ֥ירָה</w></verse></osis>',
      verseMap,
    );

    expect(verse.mapping.canonicalSlots).toEqual([
      { book: "PSA", chapter: 13, verse: 5 },
      { book: "PSA", chapter: 13, verse: 6 },
    ]);
    expect(verse.mapping.kind).toBe("many-to-many");
  });

  it("uses only accented Greek words and punctuation", () => {
    const header = [
      "OGNTsort",
      "TANTTsort",
      "FEATURESsort1",
      "LevinsohnClauseID",
      "OTquotation",
      "sorts",
      "location",
      "words",
      "entries",
      "transliteration",
      "gloss",
      "punctuation",
      "notes",
    ].join("\t");
    const row = [
      "000001",
      "000001",
      "000001",
      "c1",
      "-",
      "〔1｜1｜1〕",
      "〔40｜1｜1〕",
      "〔βιβλοϲ｜Βιβλος｜Βίβλος｜βίβλος｜N-NSF｜G976〕",
      "〔〕",
      "〔〕",
      "〔〕",
      "〔<pm>“</pm>｜<pm>,</pm><pm>”</pm>〕",
      "〔〕",
    ].join("\t");

    const [verse] = parseGreekTsv(`${header}\n${row}\n`);

    expect(verse.text).toBe("“Βίβλος,”");
    expect(verse.mapping.canonicalSlots).toEqual([
      { book: "MAT", chapter: 1, verse: 1 },
    ]);
  });
});
