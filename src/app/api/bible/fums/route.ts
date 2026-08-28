import { NextResponse } from "next/server";

import { verifyFumsReportToken } from "@/lib/bible/fums";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.API_BIBLE_KEY;
  if (!secret) {
    return response({ error: "FUMS reporting is unavailable" }, 503);
  }
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return response({ error: "Invalid JSON body" }, 400);
  }
  const body = readBody(value);
  if (!body) {
    return response({ error: "Invalid FUMS report payload" }, 400);
  }
  const payload = verifyFumsReportToken(body.token, secret);
  if (!payload) {
    return response({ error: "Invalid FUMS report token" }, 400);
  }
  const reportUrl = new URL("https://fums.api.bible/f3");
  reportUrl.searchParams.set("t", payload.id);
  reportUrl.searchParams.set("dId", body.deviceId);
  reportUrl.searchParams.set("sId", body.sessionId);
  if (body.userId) {
    reportUrl.searchParams.set("uId", body.userId);
  }
  const upstream = await fetch(reportUrl, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!upstream.ok) {
    return response({ error: "FUMS report was not accepted" }, 502);
  }
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function response(body: object, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function readBody(value: unknown): {
  token: string;
  deviceId: string;
  sessionId: string;
  userId?: string;
} | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.token !== "string" ||
    !isTrackingId(record.deviceId) ||
    !isTrackingId(record.sessionId) ||
    (record.userId !== undefined &&
      (typeof record.userId !== "string" ||
        record.userId.length === 0 ||
        record.userId.length > 256 ||
        /[\u0000-\u001f]/u.test(record.userId)))
  ) {
    return undefined;
  }
  return {
    token: record.token,
    deviceId: record.deviceId,
    sessionId: record.sessionId,
    ...(typeof record.userId === "string" ? { userId: record.userId } : {}),
  };
}

function isTrackingId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9_-]{8,128}$/u.test(value)
  );
}
