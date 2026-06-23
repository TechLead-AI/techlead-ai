/**
 * Onboarding a real GitHub repo (the live path — see CONNECT_GITHUB.md).
 *
 * The webhook only reviews PRs from a repo it knows about, authored by a user
 * flagged as a mentored junior (see `processPullRequestEvent`). The demo seed
 * wipes the database, so it can't be used to register a real repo. This module
 * registers a repo + its juniors idempotently, without touching anything else.
 *
 * The orchestration takes its database access by injection (an `OnboardStore`)
 * so it is unit-tested without a real Postgres — mirroring how the webhook
 * injects its side-effecting deps.
 */

export interface ParsedRepo {
  owner: string;
  name: string;
  fullName: string;
}

/**
 * Validate and normalise a GitHub repo reference. Accepts "owner/name" or a
 * full URL like "https://github.com/owner/name(.git)". Throws on anything that
 * isn't a single owner/name pair.
 */
export function parseRepoFullName(input: string): ParsedRepo {
  const trimmed = input.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "");
  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length !== 2) {
    throw new Error(`Invalid repo "${input}" — expected "owner/name".`);
  }
  const [owner, name] = parts;
  return { owner, name, fullName: `${owner}/${name}` };
}

/**
 * Turn a raw "logins" argument into a clean list. Accepts commas, spaces or
 * newlines as separators, strips a leading "@", and de-duplicates while
 * preserving order. Throws if nothing is left.
 */
export function normalizeLogins(raw: string): string[] {
  const seen = new Set<string>();
  const logins: string[] = [];
  for (const piece of raw.split(/[\s,]+/)) {
    const login = piece.trim().replace(/^@/, "");
    if (!login || seen.has(login)) continue;
    seen.add(login);
    logins.push(login);
  }
  if (logins.length === 0) {
    throw new Error("No junior GitHub logins given.");
  }
  return logins;
}

/** What the orchestration needs from the database. Implemented by `prismaStore`. */
export interface OnboardStore {
  /** Find an org by exact name, or create it. */
  findOrCreateOrg(name: string): Promise<{ id: string; name: string }>;
  /** Register the repo for the org if absent. `created` is false if it existed. */
  upsertRepo(orgId: string, fullName: string): Promise<{ id: string; created: boolean }>;
  /**
   * Ensure a mentored-junior user exists for this GitHub login.
   * `created` — the user row was new. `promoted` — it existed but was not yet a
   * mentored junior and we flipped the flag on.
   */
  upsertJunior(
    orgId: string,
    login: string,
  ): Promise<{ created: boolean; promoted: boolean }>;
}

export interface OnboardArgs {
  orgName: string;
  repoFullName: string;
  /** Raw, un-split list of junior GitHub logins. */
  juniorLogins: string;
}

export interface OnboardResult {
  org: { id: string; name: string };
  repo: { fullName: string; created: boolean };
  juniors: { login: string; created: boolean; promoted: boolean }[];
}

/**
 * Register a repo and its mentored juniors under an org. Idempotent: running it
 * twice with the same inputs makes no further changes.
 */
export async function onboardRepo(
  store: OnboardStore,
  args: OnboardArgs,
): Promise<OnboardResult> {
  const { fullName } = parseRepoFullName(args.repoFullName);
  const logins = normalizeLogins(args.juniorLogins);
  const orgName = args.orgName.trim();
  if (!orgName) throw new Error("Org name is required.");

  const org = await store.findOrCreateOrg(orgName);
  const repo = await store.upsertRepo(org.id, fullName);

  const juniors: OnboardResult["juniors"] = [];
  for (const login of logins) {
    const { created, promoted } = await store.upsertJunior(org.id, login);
    juniors.push({ login, created, promoted });
  }

  return {
    org,
    repo: { fullName, created: repo.created },
    juniors,
  };
}
