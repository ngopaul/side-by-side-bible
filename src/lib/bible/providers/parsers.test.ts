import { describe, expect, it } from "vitest";

import apiBibleFixture from "../__fixtures__/api-bible.json";
import esvFixture from "../__fixtures__/esv.json";
import lsmFixture from "../__fixtures__/lsm.json";
import {
  parseApiBibleContent,
  parseApiBibleResponse,
} from "./api-bible-parser";
import { parseEsvResponse } from "./esv-parser";
import { parseLsmReference, parseLsmResponse } from "./lsm-parser";

const reference = { book: "GEN", chapter: 1 } as const;

describe("provider parsers", () => {
  it("parses API.Bible JSON and HTML parallels with exact metadata", () => {
    const chapters = parseApiBibleResponse(
      apiBibleFixture,
      reference,
      new Map([
        ["nasb-id", "nasb"],
        ["niv-id", "niv"],
      ]),
    );

    expect(chapters).toHaveLength(2);
    expect(chapters[0].verses.map(({ text }) => text)).toEqual([
      "In the beginning God created.",
      "The earth was formless.",
    ]);
    expect(chapters[1].verses[1].text).toBe("Now the earth was formless.");
    expect(chapters[0].attribution.text).toBe("NASB exact copyright");
    expect(chapters[0].fums).toEqual({
      fumsId: "example",
      fumsToken: "example",
    });
  });

  it("removes API.Bible style-based verse-number nodes", () => {
    const verses = parseApiBibleContent(
      [
        {
          name: "verse-span",
          attrs: { verseId: "GEN.1.1" },
          items: [
            {
              name: "verse",
              attrs: { style: "v" },
              items: [{ type: "text", text: "1" }],
            },
          ],
        },
        {
          name: "verse-span",
          attrs: { verseId: "GEN.1.1" },
          items: [{ type: "text", text: "In the beginning." }],
        },
      ],
      reference,
    );

    expect(verses.map(({ text }) => text)).toEqual(["In the beginning."]);
  });

  it("uses ESV anchor IDs and removes untrusted markup", () => {
    const chapter = parseEsvResponse(esvFixture, reference);

    expect(chapter.verses.map(({ text }) => text)).toEqual([
      "In the beginning, God created.",
      "The earth was without form.",
    ]);
    expect(chapter.attribution.text).toBe(
      "Scripture quotations are from The ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.",
    );
  });

  it("parses LSM references and preserves response copyright", () => {
    const requested = [
      { ...reference, verse: 1 },
      { ...reference, verse: 2 },
    ];
    const parsed = parseLsmResponse(lsmFixture, reference, requested);

    expect(parsed.chapter.verses.map(({ text }) => text)).toEqual([
      lsmFixture.verses[0].text,
      lsmFixture.verses[1].text,
    ]);
    expect(parsed.chapter.attribution.text).toBe("LSM response copyright");
    expect(
      parseLsmReference("Jude 9", { book: "JUD", chapter: 1 }),
    ).toEqual({ book: "JUD", chapter: 1, verse: 9 });
    expect(
      parseLsmReference("Philem. 1:2", { book: "PHM", chapter: 1 }),
    ).toEqual({ book: "PHM", chapter: 1, verse: 2 });
  });
});
