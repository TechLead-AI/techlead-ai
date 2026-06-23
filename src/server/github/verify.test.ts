import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifySignature } from "./verify";

function sign(secret: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifySignature", () => {
  const secret = "topsecret";
  const body = '{"hello":"world"}';

  it("accepts a correct signature", () => {
    expect(verifySignature(secret, body, sign(secret, body))).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(verifySignature(secret, body + "x", sign(secret, body))).toBe(false);
  });

  it("rejects the wrong secret", () => {
    expect(verifySignature(secret, body, sign("wrong", body))).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifySignature(secret, body, null)).toBe(false);
  });
});
