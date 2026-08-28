import { afterEach, describe, expect, it, vi } from "vitest";

import { createFumsReport } from "@/lib/bible/fums";

import { POST } from "./route";

describe("FUMS report route", () => {
  const previousKey = process.env.API_BIBLE_KEY;

  afterEach(() => {
    if (previousKey === undefined) {
      delete process.env.API_BIBLE_KEY;
    } else {
      process.env.API_BIBLE_KEY = previousKey;
    }
    vi.unstubAllGlobals();
  });

  it("reports a signed display without forwarding credentials", async () => {
    process.env.API_BIBLE_KEY = "test-signing-key";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const report = createFumsReport(
      {
        fumsId: "cached-display",
        fums: "https://fums.api.bible/f3/cached-display",
      },
      "test-signing-key",
    );

    const response = await POST(
      new Request("https://app.invalid/api/bible/fums", {
        method: "POST",
        body: JSON.stringify({
          token: report.token,
          deviceId: "device-id",
          sessionId: "session-id",
        }),
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const [input, init] = fetchMock.mock.calls[0];
    const url = new URL(input.toString());
    expect(url.origin + url.pathname).toBe("https://fums.api.bible/f3");
    expect(url.searchParams.get("t")).toBe("cached-display");
    expect(url.searchParams.get("dId")).toBe("device-id");
    expect(url.searchParams.get("sId")).toBe("session-id");
    expect(init).toMatchObject({ method: "GET", cache: "no-store" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("rejects an altered token without contacting FUMS", async () => {
    process.env.API_BIBLE_KEY = "test-signing-key";
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("https://app.invalid/api/bible/fums", {
        method: "POST",
        body: JSON.stringify({
          token: "altered.token",
          deviceId: "device-id",
          sessionId: "session-id",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
