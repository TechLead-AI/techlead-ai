/**
 * Manually add a mentored junior — the admin/manager UI path.
 *
 * Onboarding (`onboard.ts`) registers juniors by GitHub login in bulk when
 * connecting a repo. This is the one-at-a-time companion for the dashboard: a
 * pure validator plus a store-injected `addJunior`, so the logic is unit-tested
 * without a real Postgres (same pattern as the webhook and onboarding).
 */

export interface NewJuniorInput {
  name: string;
  githubLogin: string;
  /** Optional team to place the junior in. */
  teamId?: string | null;
}

export interface CleanJunior {
  name: string;
  githubLogin: string;
  teamId: string | null;
}

/** Trim, strip a leading "@" from the login, and require both name and login. */
export function normalizeJuniorInput(input: NewJuniorInput): CleanJunior {
  const name = input.name.trim();
  const githubLogin = input.githubLogin.trim().replace(/^@/, "");
  const teamId = input.teamId?.trim() || null;
  if (!name) throw new Error("Name is required.");
  if (!githubLogin) throw new Error("GitHub login is required.");
  return { name, githubLogin, teamId };
}

/** What the orchestration needs from the database. Implemented by `prismaAddJuniorStore`. */
export interface AddJuniorStore {
  /** True if a user with this GitHub login already exists in the org. */
  existsByLogin(orgId: string, githubLogin: string): Promise<boolean>;
  /** Create a mentored-junior user and return its id. */
  createJunior(orgId: string, junior: CleanJunior): Promise<{ id: string }>;
}

export interface AddJuniorResult {
  id: string;
  name: string;
  githubLogin: string;
}

/**
 * Validate the input and create a mentored junior. Throws if a user with the
 * same GitHub login already exists in the org (the `(orgId, githubLogin)` unique
 * key would reject it anyway — we check first to give a friendly message).
 */
export async function addJunior(
  store: AddJuniorStore,
  orgId: string,
  input: NewJuniorInput,
): Promise<AddJuniorResult> {
  const clean = normalizeJuniorInput(input);
  if (await store.existsByLogin(orgId, clean.githubLogin)) {
    throw new Error(`@${clean.githubLogin} already exists in this org.`);
  }
  const { id } = await store.createJunior(orgId, clean);
  return { id, name: clean.name, githubLogin: clean.githubLogin };
}
