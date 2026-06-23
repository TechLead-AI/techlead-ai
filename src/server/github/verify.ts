import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a GitHub webhook signature (X-Hub-Signature-256). GitHub signs the raw
 * body with the webhook secret using HMAC-SHA256. Constant-time compare avoids
 * leaking timing information.
 */
export function verifySignature(
  secret: string,
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
