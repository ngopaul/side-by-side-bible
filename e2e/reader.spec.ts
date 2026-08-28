import { expect, test, type Page, type Route } from "@playwright/test";

type TranslationId =
  | "nasb"
  | "nkjv"
  | "niv"
  | "rcv"
  | "esv"
  | "original";

const translations = {
  nasb: metadata("nasb", "NASB", "New American Standard Bible", "English"),
  nkjv: metadata("nkjv", "NKJV", "New King James Version", "English"),
  niv: metadata("niv", "NIV", "New International Version", "English"),
  rcv: metadata("rcv", "RcV", "Recovery Version", "English"),
  esv: metadata("esv", "ESV", "English Standard Version", "English"),
  original: metadata(
    "original",
    "OSHB",
    "Open Scriptures Hebrew Bible",
    "Hebrew",
    "rtl",
  ),
} as const;

test("keeps rows aligned and reveals compact headers after scrolling", async ({
  page,
}) => {
  await mockChapters(page);
  await page.goto("/read/JHN/1?versions=esv,nasb");

  await expect(page.getByRole("heading", { name: "John 1" })).toBeVisible();
  const firstRow = page.getByTestId("verse-row-1");
  await expect(firstRow.getByText("ESV text for verse 1")).toBeVisible();
  await expect(firstRow.getByText("NASB text for verse 1")).toBeVisible();
  const cellTops = await firstRow.locator("td").evaluateAll((cells) =>
    cells.map((cell) => cell.getBoundingClientRect().top),
  );
  expect(new Set(cellTops).size).toBe(1);
  const headerBottom = await page.locator(".scripture-table thead").evaluate(
    (header) => header.getBoundingClientRect().bottom,
  );
  const firstRowTop = await firstRow.evaluate(
    (row) => row.getBoundingClientRect().top,
  );
  expect(firstRowTop).toBeGreaterThanOrEqual(headerBottom);
  await expect(page.getByTestId("sticky-version-bar")).not.toHaveClass(
    /visible/u,
  );
  const chapterLabels = await page
    .getByRole("combobox", { name: "Chapter" })
    .locator("option")
    .allTextContents();
  expect(chapterLabels.every((label) => /^\d+$/u.test(label))).toBe(true);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await expect(page.getByTestId("reader-toolbar")).toHaveCSS("position", "sticky");
  expect(
    await page.getByTestId("reader-toolbar").evaluate(
      (toolbar) => toolbar.getBoundingClientRect().top,
    ),
  ).toBe(0);
  await expect(page.getByTestId("sticky-version-bar")).toHaveClass(/visible/u);
  await expect(page.getByTestId("sticky-version-bar")).toContainText("ESV");
  await expect(page.getByTestId("sticky-version-bar")).toContainText("NASB");

  await page.getByRole("link", { name: "Next chapter" }).click();
  await expect(page).toHaveURL(/\/read\/JHN\/2\?versions=esv,nasb$/);
  await expect(page.getByRole("heading", { name: "John 2" })).toBeVisible();
});

test("persists translation and canonical-book settings", async ({ page }) => {
  await mockChapters(page);
  await page.goto(
    `/settings?returnTo=${encodeURIComponent("/read/JHN/3?versions=esv,nasb")}`,
  );
  await page.getByRole("checkbox", { name: /^NASB /u }).uncheck();
  await expect(page.getByText("Hebrew (OT) / Greek (NT)")).toBeVisible();
  await page.getByRole("checkbox", { name: /^Original /u }).check();
  await page.getByRole("button", { name: "New Testament" }).click();
  await page.getByRole("button", { name: "Save and return to reader" }).click();

  await expect(page).toHaveURL(/\/read\/JHN\/3\?versions=esv,original$/);
  await expect(
    page.locator('.version-heading[data-translation="original"]'),
  ).toHaveAttribute("dir", "ltr");
  await expect(
    page.locator('.version-heading[data-translation="original"]'),
  ).toContainText("OGNT");
  await expect(page.locator('td[lang="el"]').first()).toHaveAttribute(
    "dir",
    "ltr",
  );
  await expect(page.getByRole("option", { name: "Genesis" })).toHaveCount(0);
  await expect(page.getByRole("option", { name: "Matthew" })).toHaveCount(1);

  await page.reload();
  await expect(page).toHaveURL(/versions=esv,original$/);
  await expect(page.getByRole("option", { name: "Genesis" })).toHaveCount(0);
});

test("preserves merged cells, RTL text, attribution, and narrow overflow", async ({
  page,
}) => {
  await mockChapters(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/read/GEN/1?versions=esv,original,nasb");

  const scroll = page.getByTestId("scripture-scroll");
  expect(
    await scroll.evaluate((element) => element.scrollWidth > element.clientWidth),
  ).toBe(true);
  await expect(
    page.locator('.version-heading[data-translation="original"]'),
  ).toHaveAttribute("dir", "rtl");
  await expect(page.locator("td.hebrew-text").first()).toHaveAttribute(
    "dir",
    "rtl",
  );
  await expect(page.getByText("בְּרֵאשִׁית", { exact: true })).toBeVisible();
  await expect(page.getByText("Merged ESV verses 1–2", { exact: true })).toHaveCount(1);
  await expect(
    page.getByText("Merged ESV verses 1–2", { exact: true }).locator(".."),
  ).toHaveAttribute("rowspan", "2");
  await expect(
    page.locator("tfoot").getByText("Open Scriptures Hebrew Bible"),
  ).toBeVisible();
  await expect(page.locator("tfoot").getByText("CC BY 4.0")).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await expect(page.getByTestId("sticky-version-bar")).toHaveClass(/visible/u);
  await scroll.evaluate((element) => {
    element.scrollLeft = 100;
    element.dispatchEvent(new Event("scroll"));
  });
  await expect
    .poll(() =>
      page
        .getByTestId("sticky-version-track")
        .evaluate((element) => (element as HTMLElement).style.transform),
    )
    .toBe("translateX(-100px)");
});

test("fits two translation columns on a narrow phone", async ({ page }) => {
  await mockChapters(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/read/JHN/1?versions=esv,nasb");

  const scroll = page.getByTestId("scripture-scroll");
  await expect(page.getByText("ESV text for verse 1", { exact: true })).toBeVisible();
  expect(
    await scroll.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
});

test("migrates legacy original-language URL selections", async ({ page }) => {
  await mockChapters(page);
  await page.goto("/read/JHN/1?versions=hebrew,greek,esv");

  await expect(page).toHaveURL(/versions=original,esv$/);
  await expect(page.locator(".version-heading")).toHaveCount(2);
  await expect(
    page.locator('.version-heading[data-translation="original"]'),
  ).toContainText("OGNT");
});

test("shows isolated column errors and retries retryable failures", async ({
  page,
}) => {
  let requests = 0;
  let showError = true;
  await page.route("**/api/bible/chapter?**", async (route) => {
    requests += 1;
    await fulfillChapter(route, { nasbError: showError });
  });

  await page.goto("/read/JHN/1?versions=esv,nasb");
  await expect(page.getByText("ESV text for verse 1", { exact: true })).toBeVisible();
  await expect(page.getByText("NASB is temporarily unavailable")).toBeVisible();
  const requestsBeforeRetry = requests;
  showError = false;
  await page
    .locator('.version-heading[data-translation="nasb"]')
    .getByRole("button", { name: "Retry" })
    .click();
  await expect(page.getByText("NASB text for verse 1", { exact: true })).toBeVisible();
  expect(requests).toBeGreaterThan(requestsBeforeRetry);
});

test("uses URL versions and reports each unique FUMS display once", async ({
  page,
}) => {
  await mockChapters(page);
  const reports: unknown[] = [];
  await page.route("**/api/bible/fums", async (route) => {
    reports.push(route.request().postDataJSON());
    await route.fulfill({ status: 204 });
  });

  await page.goto("/read/JHN/1?versions=niv,nkjv");
  await expect(page.getByText("NIV text for verse 1", { exact: true })).toBeVisible();
  await expect(page.locator(".version-heading")).toHaveCount(2);
  await expect.poll(() => reports.length).toBe(1);
  expect(reports[0]).toMatchObject({
    token: "signed-token",
  });
});

async function mockChapters(page: Page) {
  await page.route("**/api/bible/chapter?**", async (route) => {
    await fulfillChapter(route);
  });
}

async function fulfillChapter(
  route: Route,
  options: { nasbError?: boolean } = {},
) {
  const url = new URL(route.request().url());
  const book = url.searchParams.get("book") ?? "JHN";
  const chapter = Number(url.searchParams.get("chapter") ?? "1");
  const selected = (url.searchParams.get("versions") ?? "esv,nasb").split(
    ",",
  ) as TranslationId[];
  const versions = selected.map((id) => ({
    translation: translationMetadata(id, book),
    attribution: attribution(id, book),
    ...(id === "nasb" && options.nasbError
      ? {
          attribution: undefined,
          error: {
            code: "upstream-unavailable",
            message: "NASB is temporarily unavailable",
            provider: "api-bible",
            retryable: true,
          },
        }
      : {}),
    ...(["niv", "nkjv"].includes(id)
      ? {
          fums: {
            fumsId: "shared-display",
            token: "signed-token",
            endpoint: "/api/bible/fums",
          },
        }
      : {}),
  }));
  const rows = Array.from({ length: 12 }, (_, index) => index + 1).map((verse) => ({
    verse,
    cells: Object.fromEntries(
      selected
        .filter((id) => !(id === "nasb" && options.nasbError))
        .map((id) => [
          id,
          [
            id === "esv" && book === "GEN" && verse <= 2
              ? {
                  translation: id,
                  text: "Merged ESV verses 1–2",
                  sourceReferences: [
                    { source: "mock", book, chapter, verse: 1 },
                  ],
                  canonicalSlots: [
                    { book, chapter, verse: 1 },
                    { book, chapter, verse: 2 },
                  ],
                  display: verse === 1,
                  rowSpan: 2,
                }
              : {
                  translation: id,
                  text:
                    id === "original" && book === "GEN" && verse === 1
                      ? "בְּרֵאשִׁית"
                      : `${translations[id].abbreviation} text for verse ${verse}`,
                  sourceReferences: [
                    { source: "mock", book, chapter, verse },
                  ],
                  canonicalSlots: [{ book, chapter, verse }],
                  display: true,
                  rowSpan: 1,
                },
          ],
        ]),
    ),
  }));
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      reference: { book, chapter },
      versions,
      rows,
    }),
  });
}

function metadata(
  id: TranslationId,
  abbreviation: string,
  name: string,
  language: "English" | "Hebrew" | "Greek" | "Original",
  direction: "ltr" | "rtl" = "ltr",
) {
  return {
    id,
    abbreviation,
    name,
    language,
    provider:
      id === "esv" ? "esv" : id === "original" ? "original" : "api-bible",
    availability: id === "original" ? ["old"] : ["old", "new"],
    direction,
  };
}

function translationMetadata(id: TranslationId, book: string) {
  if (id === "original" && book !== "GEN") {
    return {
      ...metadata(
        "original",
        "OGNT",
        "Open Greek New Testament",
        "Greek",
      ),
      availability: ["new"],
    };
  }
  return translations[id];
}

function attribution(id: TranslationId, book: string) {
  if (id === "original" && book === "GEN") {
    return {
      label: "OSHB",
      text: "Open Scriptures Hebrew Bible",
      url: "https://example.invalid/oshb",
      license: "CC BY 4.0",
    };
  }
  if (id === "original") {
    return {
      label: "OGNT",
      text: "Open Greek New Testament",
      url: "https://example.invalid/ognt",
      license: "CC BY-SA 4.0",
    };
  }
  return {
    label: translations[id].abbreviation,
    text: `${translations[id].name} mock attribution`,
  };
}
