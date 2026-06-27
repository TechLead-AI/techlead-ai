# MVP.md — Build plan for the demo

> The order we build Tech Lead AI in, so each step is shippable and testable on
> its own. Goal: a local demo. Check off steps as they land and keep this honest.
> Last updated: 2026-06-27
>
> **Status: all six steps built and verified.** 109 tests pass, the app builds and
> typechecks, the queue+worker path and dashboards are confirmed end to end. The
> live GitHub path (Step 6) is wired and unit-tested with mocked Octokit; the
> GitHub App is connected (App 4126235) and the app deploys to Railway (see
> [DEPLOY.md](DEPLOY.md)). See [README.md](README.md) to run it.

## The idea

Build in an order where you have something to **show** early and something
**real** soon after:

- After **Step 4**, the dashboards are alive (on seeded data) — fully demoable.
- After **Step 5**, the review engine produces real reviews on a real PR.
- After **Step 6**, it runs live end-to-end from GitHub.

Each step ships with tests (see `CLAUDE.md`). A step isn't done until its
"Done when" boxes are all true.

---

## Step 1 — Project skeleton

**Goal:** an empty app that runs locally with one command.

**Build:**
- Next.js (App Router) + TypeScript project.
- `docker-compose.yml` with Postgres.
- Prisma connected to that Postgres (empty schema for now).
- Vitest set up with one trivial passing test.
- A short `README` section: how to start everything locally.

**Done when:**
- [x] `docker-compose up` starts Postgres.
- [x] The Next.js app boots and shows a placeholder page.
- [x] `npm test` runs and the sample test passes.

**Tests:** one smoke test that the app/server starts and the DB connection works.

---

## Step 2 — Data model

**Goal:** the database spine everything else is built on.

**Build (Prisma schema):**
- `Org` → `Team` → `User` (role: manager / junior / admin).
- `Repo`.
- `ConventionDoc` (layered org/team/repo, versioned).
- `PullRequest`.
- `Review` (one row per review run: model version, token cost, time).
- `Comment` (Layer 1 fields + `github_comment_id` + `repeat_of` self-reference).
- `CommentFeedback` (the junior's 👎).
- `PRMetrics` (frozen snapshot: density, repeat-rate, category mix).
- `org_id` on every table (multi-tenant from day one).
- First Prisma migration.

**Done when:**
- [x] The schema matches `DESIGN.md` component 6.
- [x] Migration runs cleanly on a fresh DB.
- [x] Prisma client generates typed models.

**Tests:** create-and-read each entity; confirm relations and the `repeat_of`
self-reference work; confirm a `PRMetrics` row can't be edited after creation
(immutability rule).

---

## Step 3 — Seed script

**Goal:** realistic fake data so the dashboards look alive instantly — no GitHub
needed.

**Build:**
- A seed script (`prisma/seed.ts`) that creates: one org, a manager, a few
  juniors, several PRs each, with reviews, comments (varied severity/category),
  some `repeat_of` links, and `PRMetrics` trending over time (some juniors
  improving, some flat).
- Make the data tell a story: at least one junior clearly improving, one stuck on
  the same repeated mistake.

**Done when:**
- [x] Running the seed fills a fresh DB with believable data.
- [x] The data spans enough time to draw a trend line.

**Tests:** seed runs without error; expected row counts exist; at least one
junior shows a downward density trend.

---

## Step 4 — Dashboards (demoable!)

**Goal:** the manager and junior views, built over the seeded data.

**Build:**
- **Per-junior view:** density & repeat-rate trend charts, category breakdown,
  and the **top recurring mistakes** list.
- **Team view:** roster at-a-glance + most common team-wide mistakes.
- **Junior self-view:** same trends, worded as growth.
- GitHub OAuth login for the manager (juniors identified by GitHub handle).
- **No leaderboard** — compare each junior to their own past only.

**Done when:**
- [x] All three views render real numbers from the seeded data.
- [x] Manager can log in; sees only their org's data.
- [x] Charts show the improving vs stuck juniors clearly.

**Tests:** the metric/query functions return correct aggregates for known seed
data; org isolation (a manager can't read another org's data); dashboard
components render with sample data.

---

## Step 5 — Review engine + manual trigger

**Goal:** produce a **real** review on demand, without GitHub plumbing.

**Build:**
- The review pipeline as discrete steps: **gather context → review → summarize**
  (architected so self-check / fix-acknowledgment can be added later).
- Convention loading + merging (org/team/repo).
- Anthropic SDK call that returns structured comments (Layer 1 shape).
- Auto-post gates: confidence threshold + nit budget.
- Grading: compute `PRMetrics` from the comments.
- A **"review this PR" trigger** (paste a PR URL or pick a seeded PR) that runs
  the pipeline and writes Review + Comments + PRMetrics to the DB.
- Run it through the **queue (pg-boss)** via the **worker process**, so this is
  the same path real webhooks will use.

**Done when:**
- [x] Triggering a review writes a real Review, Comments, and PRMetrics.
- [x] Comments respect the confidence threshold and nit budget.
- [x] The new review shows up in the dashboards from Step 4.

**Tests:** pipeline steps tested in isolation with a mocked Claude response;
gates drop low-confidence and excess-nit comments; metric computation matches
expected values; the worker picks up and completes a queued job.

---

## Step 6 — GitHub App + tunnel (live end-to-end)

**Goal:** a real PR triggers a real review that gets posted back to GitHub.

**Build:**
- GitHub App (webhooks + posting permissions), installed on a test repo.
- Local webhook delivery via a tunnel (smee.io).
- Webhook receiver → enqueue → same pipeline as Step 5.
- Triggers: PR **open** + **each push** (skip drafts; new changes only on re-push).
- Only review **designated juniors**.
- Post all comments + summary as **one batched review** (Reviews API).
- Idempotency keyed on commit SHA (no double reviews/posts).

**Done when:**
- [x] Opening a PR on the test repo posts an AI review within a minute.
- [x] Pushing a fix triggers a re-review of only the new changes.
- [x] Non-junior PRs are ignored.
- [x] The same PR/commit never gets reviewed twice.

**Tests:** webhook parsing; idempotency (same SHA twice → one review); junior
filter; comments map to the single batched review payload (Octokit mocked).

---

## After the MVP (not now)

Deferred on purpose — revisit once the demo lands:
- Self-check pass in the engine.
- Fix-acknowledgment ("✅ you fixed this") on re-review.
- Notifications (weekly digest + regression alerts).
- Smarter cross-file semantic repeat-detection.
- Cloud deployment.
