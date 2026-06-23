# Tech Lead AI — Design

> Living design document. Update this whenever a decision changes.
> Last updated: 2026-06-23 (interactive dashboards + PR detail page)

## What it is

Tech Lead AI mentors junior developers by reviewing their GitHub pull requests
with an AI model, posting the reviews as PR comments, and storing the results so
managers (and the juniors themselves) can track progress on dashboards.

**North star:** mentor a junior *over time* — not just review one PR. Noticing
repeated mistakes and showing real growth is the core value, more than catching
any single bug.

**Scope:** internal use now, but architected cleanly so it can become a
multi-company SaaS later.

---

## The 9 components

| # | Component | Summary |
|---|-----------|---------|
| 1 | GitHub integration | Ingest PRs and post reviews via a GitHub App |
| 2 | Convention config | The manager's "what good means" — templated markdown |
| 3 | Review Engine | The AI brain that produces structured reviews |
| 4 | Comment + Grading model | The shape of a comment and how a junior is graded |
| 5 | Posting | Putting reviews back on GitHub |
| 6 | Data model / storage | Postgres backbone for everything |
| 7 | Dashboards | The manager's (and junior's) payoff |
| 8 | Accounts / roles | manager / junior / admin, orgs & teams |
| 9 | Notifications | Keeping people informed without spam |

---

## 1. GitHub integration

- Use a **GitHub App** (not a personal token, not a CI Action): installs on an
  org's repos, receives webhooks, posts as its own bot identity, scales to many
  orgs later.
- **Triggers:** review on PR **open** and on **each push** of new commits. Skip
  draft PRs. On re-push, review **only the new changes** (v1).
- **Who is reviewed:** only **designated juniors**. The manager marks which
  GitHub users are mentored; everyone else's PRs are ignored. Controls cost and
  keeps the tool purposeful.
- **Posting:** post all inline comments + the summary as **one batched review
  event** (GitHub Reviews API) → a single notification, not spam.
- **Idempotency:** key all work off the commit SHA so duplicate/retried webhooks
  never cause a double-review or double-post.
- **Cost/rate control:** queue review work; cap concurrent expensive reviews.

## 2. Convention config

- The manager's document of "what good code looks like" for their team.
- **Layered:** org → team → repo. The engine merges them.
- **Format:** **templated markdown** — suggested section headers (style,
  architecture, testing, git/PR hygiene, security, language-specifics) plus room
  for good/bad code examples. Concrete examples produce much better reviews.
- **Versioned:** a review references the rules *as they were when it ran*, so old
  reviews stay coherent after the manager edits conventions.
- **Insight loop:** when a mistake recurs across the whole team, suggest adding
  it to the conventions doc.
- **Editing:** managers edit conventions in-app on a **Manage Conventions** page
  laid out as a directory tree (organization → teams → repositories), so it is
  obvious which layer each doc belongs to. Saving writes a new version (never
  mutates), honouring the versioning rule above. The review engine merges the
  PR author's org + team + repo layers.
- **Reality check:** review quality is capped by this document's quality. The
  template exists to fight vague input.

## 3. Review Engine

Per-PR pipeline, built as discrete steps so deferred features slot in later:

1. **Gather context** — the diff (chunked if large), the merged convention docs,
   the junior's **recent history** (past/repeated mistakes), and the surrounding
   code the diff touches.
2. **Review** — produce structured comments. Convention-grounded: every comment
   maps to a rule or a stated principle (no hallucinated opinions). The model
   assigns severity + confidence; auto-post gates then filter.
3. **Summarize** — one top-level PR comment: overall take + the 1–2 things that
   matter most.

**v1 scope (with planned follow-ups):**
- **No self-check pass** in v1 — but architect so it can be added. (It's the
  biggest quality lever once auto-posting.)
- **Re-review covers only new changes** in v1 — add fix-acknowledgment
  ("✅ you fixed this") later.

**Known hard problems:**
- Semantic repeat-detection ("same mistake" across different files) — v1 detects
  repeats *within a category* only; improve later.
- Big PRs — need chunking + a per-PR cost ceiling.

## 4. Comment + Grading model

Three separate layers; keeping them distinct is the whole game.

### Layer 1 — the comment (about the *code*)
Fields: `location`, `category` (bug / security / design / test / convention /
readability / naming), `severity` (blocker / major / minor / nit), `confidence`
(0–1), `message`, **`why`** (mandatory — the mentoring), optional `suggestion`,
`convention_ref`, `repeat_of`.

Severity scale (mapped to weights for aggregation): blocker=8, major=4, minor=2,
nit=0.5. **Severity describes the code, never the person.**

### Layer 2 — auto-post gates (no human in the loop)
- **Confidence threshold** (~0.7): below it, don't post (or soften to "consider…").
- **Nit budget:** cap nits per PR; summarize the rest.
- **👎 feedback capture:** the junior can flag "this was wrong." Under full
  automation this is the *only* signal that the AI erred — not optional.

### Layer 3 — the grade (about the *person*, over time)
A **small profile**, not a single 0–100 score:
- **issue density** — weighted severity per 100 lines changed
- **repeat-mistake rate** — % of comments repeating a past mistake (↓ = learning)
- **category mix** — graduating from nit/convention issues up to design discussions

**Progress = density ↓ and repeat-rate ↓ while task difficulty holds or rises.**

**Visibility:** manager **and** the junior see the profile → metrics are framed
as growth, never as a threatening score.

## 5. Posting

- Single batched GitHub review event per review run (see component 1).
- Posted under the GitHub App's bot identity.

## 6. Data model / storage

**Database: Postgres.**

Core entities:
- **Org** → **Team** → **User** (role: manager / junior / admin)
- **Repo** (belongs to org, linked to GitHub)
- **ConventionDoc** (layered org/team/repo, versioned)
- **PullRequest** (GitHub id, author=junior, repo, size, status)
- **Review** — one row per review *run* on a PR (model version, token cost, time)
- **Comment** — Layer 1 fields + `github_comment_id` + `repeat_of` (self-ref)
- **CommentFeedback** — the junior's 👎 / "this was wrong"
- **PRMetrics** — a frozen snapshot per PR (density, repeat-rate, category mix)

Two firm rules:
- **`org_id` on every table from day one** — cheap now, miserable to retrofit;
  enables the SaaS-later path.
- **Freeze metrics as immutable per-PR snapshots** — don't recompute live. The
  model and scoring formula will change; progress charts must stay stable.

**Identity:** juniors are mapped by GitHub username (no separate login in v1);
managers log in via GitHub OAuth.

**HR-sensitive data:** these are durable performance judgments about named
employees. Bake in a retention policy, per-user data deletion, and clear
ownership (the company's, not the builder's) before going SaaS.

## 7. Dashboards

Three views:
- **Per-junior (manager + junior):** density & repeat-rate trends, category
  breakdown, and the key widget — **top recurring mistakes** (the 1:1 agenda).
- **Team (manager):** a headline **stat strip** (mentored juniors, reviews run,
  avg density, open blockers+majors), a **needs-attention** callout (juniors
  trending worse or stuck repeating mistakes), the roster at-a-glance, a
  **severity breakdown**, and most common team-wide mistakes (feeds the
  conventions loop).
- **Junior's own view:** the same trends, framed as growth.
- **All-PRs view (manager):** every junior PR in one place — a pie of PRs per
  junior and a histogram of PRs per day, then a searchable, sortable table
  (default newest-first; click any column to re-sort; search by PR title,
  junior, or repo). Each row links to the PR detail page.

**No leaderboard.** Compare a junior against their own past, never against peers.

**Everything drills down.** The dashboards are interactive, not static:
- **Trend charts** show each point's date + value on hover; clicking a point
  opens the PR behind it.
- **Category / mistake bars** expand on click to list the contributing comments,
  each linking to its PR.
- **PR detail page** (`/dashboard/prs/[id]`): the PR header, the review
  summary, and every comment with its full Layer 1 data (location, severity,
  category, confidence, message, the mandatory *why*, suggestion, convention ref,
  whether it was posted, and repeat links). Re-reviewed PRs show every run,
  newest first. Org-scoped; a junior can only open their own PRs.

## 8. Accounts / roles

- Roles: **manager**, **junior**, **admin**.
- Managers authenticate via GitHub OAuth; juniors are identified by GitHub handle.
- Org / team structure present from the start (multi-tenant ready).

## 9. Notifications

Keep v1 tiny:
- The **GitHub review** is the junior's notification.
- The manager gets a **weekly digest** + an **alert on regression / stuck** junior.
- Build nothing more until it's asked for.

---

## Tech stack & architecture

**Priority: a local demo that runs on a laptop.** No cloud deployment for now;
the architecture stays deployment-agnostic for later.

**Stack:**
- **TypeScript + Next.js (App Router)** — one app serves the dashboard UI, the
  API, the GitHub webhook endpoint, and GitHub OAuth.
- **Postgres via Docker Compose** — `docker-compose up` and the DB is local.
- **Prisma** — ORM, typed models, migrations. Chosen for readability (rule #1).
- **pg-boss** — job queue that runs on the existing Postgres (no Redis). The
  review worker runs as a separate local process so a flood of reviews never
  blocks incoming webhooks.
- **Anthropic SDK** — the review engine (exact Claude model TBD; likely Sonnet
  for cost/speed on reviews).
- **Octokit + GitHub App** — ingestion and posting.
- **Vitest** — tests (rule: lots of tests per component).

**Shape:**

```
GitHub ──webhook──▶ [Next.js API route] ──enqueue──▶ [pg-boss] ──▶ [Review worker] ──▶ Claude API
                          │                                              │
                     [Dashboard UI] ◀────── reads ──────────────────▶ [Postgres]
```

**Demo path:** build **seeded data + a manual "review this PR" trigger first**
(dashboards alive immediately, engine testable offline), then add a **real
GitHub tunnel** (smee.io) for true end-to-end PR → review → post. Architect the
webhook and manual-trigger paths to share the same review pipeline.

---

## Consciously-held risks

1. **Trust under full automation** — no human gate. The 👎 signal + confidence
   threshold + nit budget are the safety net; the self-check pass is the planned
   reinforcement.
2. **Convention quality caps review quality** — fought with templating.
3. **HR-sensitive data** — retention, deletion, ownership before SaaS.

---

## Implementation notes (demo build)

- **Auth:** a cookie-based "sign in as" stands in for GitHub OAuth so the demo
  runs offline; org scoping and roles are real and unchanged for Step 6.
- **Manual trigger** runs the review inline for an immediate result; the GitHub
  webhook path runs through the pg-boss queue + worker. Both call the same
  review service, so there is one pipeline. The trigger asks only for author,
  repo, title, and the diff — PR size (lines changed) is derived from the diff,
  not entered by hand.
- **Offline reviewer:** with no `ANTHROPIC_API_KEY`, a `FakeReviewer` scans the
  diff for common smells; with a key, the Claude-backed reviewer is used.
- **Status:** all six MVP steps built; 55 tests pass; app builds & typechecks.
  See [MVP.md](MVP.md) and [README.md](README.md).

## Open / next

- Exercise the live GitHub path against a real repo (needs App credentials).
- Deferred features: engine self-check pass, fix-acknowledgment on re-review,
  notifications (digest + alerts), smarter semantic repeat-detection.
- Pick the production Claude model and tune the review prompt.
