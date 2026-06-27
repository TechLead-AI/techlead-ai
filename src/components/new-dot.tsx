"use client";

import { useEffect, useState } from "react";

/**
 * A small blue dot marking something added very recently (within the last
 * hour), e.g. a freshly opened PR.
 *
 * "Recent" depends on the current time, which differs between the server and
 * the browser — computing it during render would risk a React hydration
 * mismatch (see lib/format.ts for the same concern). So we render nothing on
 * the server and on the first client paint (markup matches), then decide after
 * mount. The dot simply doesn't appear until the page has hydrated.
 */
const ONE_HOUR_MS = 60 * 60 * 1000;

export function NewDot({ since }: { since: number }) {
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    setIsNew(Date.now() - since < ONE_HOUR_MS);
  }, [since]);

  if (!isNew) return null;

  return (
    <span
      role="img"
      aria-label="new"
      title="Added in the last hour"
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "var(--accent)",
        marginRight: 6,
        verticalAlign: "middle",
        flexShrink: 0,
      }}
    />
  );
}
