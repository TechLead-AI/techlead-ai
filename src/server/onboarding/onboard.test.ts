import { describe, it, expect } from "vitest";
import {
  parseRepoFullName,
  normalizeLogins,
  onboardRepo,
  type OnboardStore,
} from "./onboard";

describe("parseRepoFullName", () => {
  it("accepts a plain owner/name", () => {
    expect(parseRepoFullName("colman/web-app")).toEqual({
      owner: "colman",
      name: "web-app",
      fullName: "colman/web-app",
    });
  });

  it("strips a github URL and a trailing .git", () => {
    expect(parseRepoFullName("https://github.com/colman/web-app.git").fullName).toBe(
      "colman/web-app",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(parseRepoFullName("  colman/web-app  ").fullName).toBe("colman/web-app");
  });

  it.each(["colman", "colman/web-app/extra", "", "   ", "/"])(
    "rejects %j",
    (bad) => {
      expect(() => parseRepoFullName(bad)).toThrow(/Invalid repo/);
    },
  );
});

describe("normalizeLogins", () => {
  it("splits on commas, spaces and newlines", () => {
    expect(normalizeLogins("alice, bob\ncarol dave")).toEqual([
      "alice",
      "bob",
      "carol",
      "dave",
    ]);
  });

  it("strips a leading @ and de-duplicates while keeping order", () => {
    expect(normalizeLogins("@alice, alice, @bob")).toEqual(["alice", "bob"]);
  });

  it("throws when nothing usable remains", () => {
    expect(() => normalizeLogins("  ,  , ")).toThrow(/No junior/);
  });
});

/**
 * A fake store that records every call, lets us preset which users already
 * exist (and whether they are already mentored), and creates the org/repo on
 * first sight — enough to assert the orchestration's behaviour.
 */
function fakeStore(opts?: {
  existingOrgId?: string;
  existingRepo?: boolean;
  existingJuniors?: Record<string, boolean>; // login -> isMentoredJunior
}) {
  const existingJuniors = opts?.existingJuniors ?? {};
  const calls = { orgs: [] as string[], repos: [] as string[], juniors: [] as string[] };
  const store: OnboardStore = {
    async findOrCreateOrg(name) {
      calls.orgs.push(name);
      return { id: opts?.existingOrgId ?? "org_new", name };
    },
    async upsertRepo(orgId, fullName) {
      calls.repos.push(`${orgId}:${fullName}`);
      return { id: "repo_1", created: !opts?.existingRepo };
    },
    async upsertJunior(orgId, login) {
      calls.juniors.push(`${orgId}:${login}`);
      if (!(login in existingJuniors)) return { created: true, promoted: false };
      return { created: false, promoted: !existingJuniors[login] };
    },
  };
  return { store, calls };
}

describe("onboardRepo", () => {
  it("registers a new org, repo and juniors", async () => {
    const { store, calls } = fakeStore();
    const result = await onboardRepo(store, {
      orgName: "Colman",
      repoFullName: "colman/web-app",
      juniorLogins: "alice, bob",
    });

    expect(result.org).toEqual({ id: "org_new", name: "Colman" });
    expect(result.repo).toEqual({ fullName: "colman/web-app", created: true });
    expect(result.juniors).toEqual([
      { login: "alice", created: true, promoted: false },
      { login: "bob", created: true, promoted: false },
    ]);
    expect(calls.repos).toEqual(["org_new:colman/web-app"]);
  });

  it("is idempotent: existing repo and juniors report no changes", async () => {
    const { store } = fakeStore({
      existingOrgId: "org_1",
      existingRepo: true,
      existingJuniors: { alice: true, bob: true },
    });
    const result = await onboardRepo(store, {
      orgName: "Colman",
      repoFullName: "colman/web-app",
      juniorLogins: "alice bob",
    });

    expect(result.repo.created).toBe(false);
    expect(result.juniors.every((j) => !j.created && !j.promoted)).toBe(true);
  });

  it("promotes an existing non-junior user", async () => {
    const { store } = fakeStore({ existingJuniors: { alice: false } });
    const result = await onboardRepo(store, {
      orgName: "Colman",
      repoFullName: "colman/web-app",
      juniorLogins: "alice",
    });
    expect(result.juniors[0]).toEqual({ login: "alice", created: false, promoted: true });
  });

  it("normalises the repo and dedupes juniors before storing", async () => {
    const { store, calls } = fakeStore();
    await onboardRepo(store, {
      orgName: "Colman",
      repoFullName: "https://github.com/colman/web-app.git",
      juniorLogins: "@alice, alice",
    });
    expect(calls.repos).toEqual(["org_new:colman/web-app"]);
    expect(calls.juniors).toEqual(["org_new:alice"]);
  });

  it("rejects a blank org name", async () => {
    const { store } = fakeStore();
    await expect(
      onboardRepo(store, { orgName: "  ", repoFullName: "a/b", juniorLogins: "x" }),
    ).rejects.toThrow(/Org name/);
  });

  it("rejects an invalid repo before any store call", async () => {
    const { store, calls } = fakeStore();
    await expect(
      onboardRepo(store, { orgName: "Colman", repoFullName: "nope", juniorLogins: "x" }),
    ).rejects.toThrow(/Invalid repo/);
    expect(calls.orgs).toEqual([]);
  });
});
