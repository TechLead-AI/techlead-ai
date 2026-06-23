import { describe, it, expect, afterEach, vi } from "vitest";
import { prisma } from "@/server/db/client";
import {
  shouldReviewAction,
  parsePullRequestEvent,
  processPullRequestEvent,
  type PullRequestEvent,
} from "./webhook";

describe("shouldReviewAction (pure)", () => {
  it("reviews opened and synchronize", () => {
    expect(shouldReviewAction("opened", false)).toBe(true);
    expect(shouldReviewAction("synchronize", false)).toBe(true);
  });
  it("skips drafts", () => {
    expect(shouldReviewAction("opened", true)).toBe(false);
  });
  it("ignores other actions", () => {
    expect(shouldReviewAction("closed", false)).toBe(false);
  });
});

describe("parsePullRequestEvent (pure)", () => {
  it("extracts the fields we need", () => {
    const event = parsePullRequestEvent({
      action: "opened",
      repository: { full_name: "acme/app" },
      pull_request: {
        number: 7,
        title: "Add x",
        draft: false,
        head: { sha: "deadbeef" },
        user: { login: "ivy-dev" },
        additions: 30,
        deletions: 10,
      },
    });
    expect(event).toMatchObject({
      action: "opened",
      repoFullName: "acme/app",
      number: 7,
      headSha: "deadbeef",
      authorLogin: "ivy-dev",
      linesChanged: 40,
    });
  });

  it("returns null for a non-PR payload", () => {
    expect(parsePullRequestEvent({ action: "x" })).toBeNull();
  });
});

// --- DB-backed processing ---

const createdOrgIds: string[] = [];
afterEach(async () => {
  for (const id of createdOrgIds.splice(0)) {
    await prisma.org.delete({ where: { id } }).catch(() => {});
  }
});

function event(overrides: Partial<PullRequestEvent> = {}): PullRequestEvent {
  return {
    action: "opened",
    draft: false,
    repoFullName: "acme/hook",
    number: 1,
    title: "PR",
    headSha: "sha1",
    authorLogin: "ivy-dev",
    linesChanged: 50,
    ...overrides,
  };
}

const deps = () => ({
  fetchDiff: vi.fn(async (_repo: string, _num: number) => "+++ b/a.ts\n@@ -0,0 +1,1 @@\n+console.log(1);"),
  enqueue: vi.fn(async (_data: { orgId: string; github?: { repoFullName: string; prNumber: number } }) => {}),
});

describe("processPullRequestEvent", () => {
  it("ignores non-reviewable actions", async () => {
    const d = deps();
    expect(await processPullRequestEvent(event({ action: "closed" }), d)).toBe(
      "ignored_action",
    );
    expect(d.enqueue).not.toHaveBeenCalled();
  });

  it("returns unknown_repo when the repo is not registered", async () => {
    const d = deps();
    expect(
      await processPullRequestEvent(event({ repoFullName: "no/such" }), d),
    ).toBe("unknown_repo");
  });

  it("skips authors who are not mentored juniors", async () => {
    const org = await prisma.org.create({ data: { name: "Hook Org" } });
    createdOrgIds.push(org.id);
    await prisma.repo.create({ data: { orgId: org.id, fullName: "acme/hook" } });
    await prisma.user.create({
      data: { orgId: org.id, role: "junior", githubLogin: "ivy-dev", name: "Ivy", isMentoredJunior: false },
    });
    const d = deps();
    expect(await processPullRequestEvent(event(), d)).toBe("not_mentored_junior");
    expect(d.enqueue).not.toHaveBeenCalled();
  });

  it("queues a review for a mentored junior and passes github info", async () => {
    const org = await prisma.org.create({ data: { name: "Hook Org 2" } });
    createdOrgIds.push(org.id);
    await prisma.repo.create({ data: { orgId: org.id, fullName: "acme/hook" } });
    await prisma.user.create({
      data: { orgId: org.id, role: "junior", githubLogin: "ivy-dev", name: "Ivy", isMentoredJunior: true },
    });
    const d = deps();
    const outcome = await processPullRequestEvent(event(), d);
    expect(outcome).toBe("queued");
    expect(d.fetchDiff).toHaveBeenCalledWith("acme/hook", 1);
    expect(d.enqueue).toHaveBeenCalledTimes(1);
    const arg = d.enqueue.mock.calls[0][0];
    expect(arg.github).toEqual({ repoFullName: "acme/hook", prNumber: 1 });
    expect(arg.orgId).toBe(org.id);
  });
});
