import { createHmac, timingSafeEqual } from "node:crypto";

import type { FumsMetadata, FumsReport } from "./types";

interface FumsTokenPayload {
  id: string;
}

export function createFumsReport(
  metadata: FumsMetadata,
  secret: string,
): FumsReport {
  const payload: FumsTokenPayload = { id: metadata.fumsId };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return {
    fumsId: metadata.fumsId,
    token: `${encoded}.${signature(encoded, secret)}`,
    endpoint: "/api/bible/fums",
  };
}

export function verifyFumsReportToken(
  token: string,
  secret: string,
): FumsTokenPayload | undefined {
  const [encoded, suppliedSignature, extra] = token.split(".");
  if (!encoded || !suppliedSignature || extra) {
    return undefined;
  }
  const expectedSignature = signature(encoded, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return undefined;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<FumsTokenPayload>;
    if (typeof payload.id !== "string" || !payload.id) {
      return undefined;
    }
    return { id: payload.id };
  } catch {
    return undefined;
  }
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
