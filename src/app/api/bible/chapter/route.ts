import { NextResponse } from "next/server";

import { createBibleProviders } from "@/lib/bible/providers";
import { BibleRequestError, BibleService } from "@/lib/bible/service";

export const dynamic = "force-dynamic";

const service = new BibleService(
  createBibleProviders(),
  process.env.API_BIBLE_KEY,
);

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const book = url.searchParams.get("book") ?? "";
  const chapterValue = url.searchParams.get("chapter") ?? "";
  const versionsValue = url.searchParams.get("versions") ?? "";
  const chapter = /^\d+$/u.test(chapterValue)
    ? Number(chapterValue)
    : Number.NaN;
  const translations = versionsValue
    ? versionsValue.split(",").map((value) => value.trim())
    : [];

  try {
    const result = await service.getChapter({
      book,
      chapter,
      translations,
    });
    return NextResponse.json(result, { headers: noStoreHeaders() });
  } catch (error) {
    if (error instanceof BibleRequestError) {
      return NextResponse.json(
        {
          error: {
            code: "invalid-request",
            field: error.field,
            message: error.message,
          },
        },
        { status: 400, headers: noStoreHeaders() },
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "internal-error",
          message: "Unable to prepare the chapter response",
        },
      },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}

function noStoreHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
  };
}
