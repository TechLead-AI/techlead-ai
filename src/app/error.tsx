"use client";

/**
 * Route-level error boundary. Next.js requires an error component per segment;
 * without one, navigations that hit an error log "missing required error
 * components, refreshing…" and force a hard reload. This catches the error and
 * offers a retry instead.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ maxWidth: 560, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ marginBottom: 8 }}>Something went wrong</h1>
      <p style={{ color: "var(--muted)" }}>
        {error.message || "An unexpected error occurred."}
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <button
          onClick={reset}
          style={{
            background: "var(--accent)",
            color: "#0b0c10",
            border: "none",
            borderRadius: 8,
            padding: "10px 16px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <a href="/dashboard" style={{ alignSelf: "center" }}>
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
