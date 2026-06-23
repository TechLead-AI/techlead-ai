/**
 * Deterministic, locale-independent date formatting.
 *
 * `toLocaleDateString()` formats differently depending on the runtime's locale
 * and timezone, so using it inside a client component produces different text on
 * the server vs the browser — a React hydration mismatch. We format from UTC
 * parts so every environment renders exactly the same string.
 */
const pad = (n: number) => String(n).padStart(2, "0");

/** "DD/MM/YYYY", e.g. "09/06/2026". Accepts a Date, ISO string, or epoch ms. */
export function formatDate(input: Date | string | number): string {
  const d = new Date(input);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** "DD/MM", e.g. "09/06" — for compact axis ticks (used by chart labels). */
export function formatDayMonth(input: Date | string | number): string {
  const d = new Date(input);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
}
