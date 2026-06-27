import { describe, it, expect } from "vitest";
import {
  normalizeJuniorInput,
  addJunior,
  type AddJuniorStore,
  type CleanJunior,
} from "./add-junior";

describe("normalizeJuniorInput", () => {
  it("trims the name and strips a leading @ from the login", () => {
    expect(
      normalizeJuniorInput({ name: "  Jordan Lee ", githubLogin: " @jordan-dev " }),
    ).toEqual({ name: "Jordan Lee", githubLogin: "jordan-dev", teamId: null });
  });

  it("treats a blank team as no team", () => {
    expect(
      normalizeJuniorInput({ name: "A", githubLogin: "a", teamId: "   " }).teamId,
    ).toBeNull();
  });

  it("keeps a real team id", () => {
    expect(
      normalizeJuniorInput({ name: "A", githubLogin: "a", teamId: "team_1" }).teamId,
    ).toBe("team_1");
  });

  it("rejects a missing name", () => {
    expect(() => normalizeJuniorInput({ name: "  ", githubLogin: "a" })).toThrow(
      /Name is required/,
    );
  });

  it("rejects a missing login", () => {
    expect(() => normalizeJuniorInput({ name: "A", githubLogin: " @ " })).toThrow(
      /GitHub login is required/,
    );
  });
});

/** A fake store: preset which logins already exist, record what gets created. */
function fakeStore(existingLogins: string[] = []) {
  const created: { orgId: string; junior: CleanJunior }[] = [];
  const store: AddJuniorStore = {
    async existsByLogin(_orgId, githubLogin) {
      return existingLogins.includes(githubLogin);
    },
    async createJunior(orgId, junior) {
      created.push({ orgId, junior });
      return { id: "user_new" };
    },
  };
  return { store, created };
}

describe("addJunior", () => {
  it("creates a mentored junior from clean input", async () => {
    const { store, created } = fakeStore();
    const result = await addJunior(store, "org_1", {
      name: " Jordan ",
      githubLogin: "@jordan-dev",
      teamId: "team_1",
    });

    expect(result).toEqual({ id: "user_new", name: "Jordan", githubLogin: "jordan-dev" });
    expect(created).toEqual([
      { orgId: "org_1", junior: { name: "Jordan", githubLogin: "jordan-dev", teamId: "team_1" } },
    ]);
  });

  it("rejects a login that already exists in the org", async () => {
    const { store, created } = fakeStore(["jordan-dev"]);
    await expect(
      addJunior(store, "org_1", { name: "Jordan", githubLogin: "jordan-dev" }),
    ).rejects.toThrow(/already exists/);
    expect(created).toEqual([]); // nothing written
  });

  it("validates before touching the store", async () => {
    const { store, created } = fakeStore();
    await expect(
      addJunior(store, "org_1", { name: "", githubLogin: "x" }),
    ).rejects.toThrow(/Name is required/);
    expect(created).toEqual([]);
  });
});
