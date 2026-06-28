// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useElementWidth } from "./use-element-width";

describe("useElementWidth", () => {
  it("returns the fallback width until the element is measured", () => {
    // jsdom has no layout (clientWidth is 0), so the hook keeps the fallback —
    // the same path used during server render and the first client paint.
    const { result } = renderHook(() => useElementWidth(340));
    expect(result.current.width).toBe(340);
  });

  it("exposes a ref to attach to the measured element", () => {
    const { result } = renderHook(() => useElementWidth(200));
    expect(result.current.ref).toHaveProperty("current");
  });
});
