"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Measures an element's content width so an SVG chart can fill its container
 * instead of being stuck at a fixed pixel width (which overflows on a phone).
 *
 * Returns a `ref` to attach to the wrapper plus the current `width`. Until the
 * element is measured — during server render, the first client paint, or in test
 * environments without layout — `width` is the given `fallback`, so rendering
 * stays stable.
 */
export function useElementWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    // Ignore zero widths (e.g. a detached node) so we never collapse the chart.
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setWidth(w);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
