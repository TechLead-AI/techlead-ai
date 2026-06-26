import { describe, it, expect } from "vitest";
import { relativeRedirect } from "./redirect";

describe("relativeRedirect", () => {
  it("sets a relative Location header (no host)", () => {
    const res = relativeRedirect("/dashboard");
    expect(res.headers.get("location")).toBe("/dashboard");
  });

  it("defaults to a 303 See Other status", () => {
    const res = relativeRedirect("/login");
    expect(res.status).toBe(303);
  });

  it("allows overriding the status code", () => {
    const res = relativeRedirect("/login", 307);
    expect(res.status).toBe(307);
  });

  it("does not embed the request host in the redirect target", () => {
    const res = relativeRedirect("/dashboard/juniors/abc");
    const location = res.headers.get("location") ?? "";
    expect(location.startsWith("/")).toBe(true);
    expect(location).not.toContain("localhost");
    expect(location).not.toContain("http");
  });
});
