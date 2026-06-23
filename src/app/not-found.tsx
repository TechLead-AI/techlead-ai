/**
 * Global 404 boundary. Pages call `notFound()` (e.g. an unknown PR or junior);
 * without this component the App Router has no not-found UI to render.
 */
export default function NotFound() {
  return (
    <div style={{ maxWidth: 560, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ marginBottom: 8 }}>Not found</h1>
      <p style={{ color: "var(--muted)" }}>
        That page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <a href="/dashboard">Back to dashboard</a>
    </div>
  );
}
