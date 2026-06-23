"use client";

/**
 * Last-resort boundary for errors thrown in the root layout itself. It must
 * render its own <html>/<body> because it replaces the whole document.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 40 }}>
        <h1>Something went wrong</h1>
        <p>{error.message || "An unexpected error occurred."}</p>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
