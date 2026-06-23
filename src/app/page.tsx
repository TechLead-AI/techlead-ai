export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: "80px auto", padding: "0 24px" }}>
      <h1>Tech Lead AI</h1>
      <p style={{ color: "var(--muted)" }}>
        Mentors junior developers by reviewing their pull requests.
      </p>
      <p>
        <a href="/dashboard">Go to the dashboard →</a>
      </p>
    </main>
  );
}
