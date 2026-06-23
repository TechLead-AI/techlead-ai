/**
 * Tiny health helper used by the Step 1 smoke test and a /health route.
 * Kept trivial on purpose: it proves the app and test setup are wired up.
 */
export function appName(): string {
  return "Tech Lead AI";
}

export function isHealthy(): boolean {
  return true;
}
