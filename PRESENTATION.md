# Tech Lead AI

### An AI senior engineer that mentors junior developers — by reviewing their pull requests, posting feedback on GitHub, and tracking each junior's growth over time.

> **The pitch in one sentence:** every other AI reviewer checks *a PR*. Tech Lead
> AI mentors *a person* — it remembers past mistakes, frames feedback as growth,
> and gives managers a real picture of how each junior is developing.

![Team overview dashboard](docs/screenshots/01-team-overview.png)

---

## Contents

1. [Purpose — the need we fill](#1-purpose--the-need-we-fill)
2. [Architecture](#2-architecture)
3. [How the main components are built](#3-how-the-main-components-are-built)
4. [A real review, end to end (worked example)](#4-a-real-review-end-to-end-worked-example)
5. [The website — what you can do there](#5-the-website--what-you-can-do-there)
6. [How the review flow works](#6-how-the-review-flow-works)
7. [What makes it different](#7-what-makes-it-different)
8. [Extra things worth highlighting](#8-extra-things-worth-highlighting)
9. [Risks & honest tradeoffs](#9-risks--honest-tradeoffs)
10. [Roadmap — what's next](#10-roadmap--whats-next)
11. [Closing & quick facts](#11-closing--quick-facts)

---

## 1. Purpose — the need we fill

Junior developers grow fastest with consistent, high-quality code review. On real
teams that rarely happens:

- **Senior time is scarce.** Thorough reviews are the first thing dropped when the
  team is busy. Juniors get a rushed "LGTM" instead of mentoring.
- **Feedback is inconsistent.** Different reviewers care about different things;
  the junior gets contradictory signals and no clear standard.
- **Nobody tracks growth.** Review comments live and die inside a single PR. No
  one can answer *"is this person actually getting better, and at what?"*

**Tech Lead AI fills that gap.** It acts as a tireless senior reviewer that:

1. Reviews every junior PR against the team's *own* written conventions.
2. Posts mentoring feedback — every comment explains the **why**, not just the what.
3. Remembers each junior over time, so it can spot **repeated mistakes** and show
   **real growth** on a dashboard.

> **North star:** mentor a junior *over time* — not just review one PR. Noticing
> repeated mistakes and showing growth is the core value, more than catching any
> single bug.

**Scope:** internal use today, but architected as multi-tenant SaaS from day one
(`org_id` on every table, org → team → user structure).

📷 *Suggested visuals:*
- A "before / after" split: a tired senior dev buried in PRs vs. the AI reviewer calmly handling them.
- A simple problem → solution diagram (the 3 pain points above → the 3 things we do).

---

## 2. Architecture

One Next.js app serves everything (dashboard UI, API, GitHub webhook, OAuth), with
a separate worker process so a flood of reviews never blocks incoming webhooks.

```mermaid
flowchart LR
  GH["GitHub PR opened / pushed"] -- webhook --> API["/api/github/webhook"]
  API -- enqueue --> Q[("pg-boss queue<br/>on Postgres")]
  Q --> W["Review worker"]
  MAN["Manual: Review a PR form"] --> SVC
  W --> SVC["Review Service<br/>one shared pipeline"]
  SVC --> AI{{"Claude<br/>or offline FakeReviewer"}}
  SVC --> DB[("Postgres / Prisma")]
  SVC -- batched review --> GH
  DASH["Dashboards / Next.js"] -- reads --> DB
```

**Key architectural decisions:**

- **One pipeline, two entry points.** The manual "Review a PR" trigger and the
  GitHub webhook both call the *same* review service (`src/server/review/service.ts`).
  No duplicated logic.
- **Queue-backed reviews.** GitHub webhooks enqueue work via **pg-boss** (a queue
  that runs on the existing Postgres — no Redis needed). The worker consumes it,
  so webhook delivery stays fast and we can cap concurrent expensive AI calls.
- **Idempotency by commit SHA.** Duplicate/retried webhooks never cause a
  double-review or double-post.
- **Multi-tenant from day one.** `org_id` on every table and every query;
  org → team → user → repo hierarchy. Cheap now, miserable to retrofit later.
- **Frozen metric snapshots.** Per-PR metrics are written once and never
  recomputed. The model and scoring formula will change; progress charts must
  stay stable.
- **Offline-first demo.** With no `ANTHROPIC_API_KEY`, a `FakeReviewer` scans the
  diff for common smells, so the whole system runs and demos without any cloud
  dependency.

**The data model** (Postgres via Prisma):

```mermaid
erDiagram
  Org ||--o{ Team : has
  Org ||--o{ User : has
  Org ||--o{ Repo : has
  Org ||--o{ ConventionDoc : has
  Team ||--o{ User : groups
  Repo ||--o{ PullRequest : has
  User ||--o{ PullRequest : authors
  PullRequest ||--o{ Review : "reviewed by"
  Review ||--o{ Comment : produces
  Review ||--|| PRMetrics : "frozen snapshot"
  Comment ||--o{ CommentFeedback : "👎 this was wrong"
```

**Stack:** TypeScript + Next.js (App Router), Postgres via Docker Compose, Prisma
ORM, pg-boss queue, Anthropic SDK, Octokit (GitHub App), Vitest for tests.

📷 *Suggested visuals:*
- A small logo strip of the stack (Next.js, Postgres, Prisma, Anthropic, GitHub).
- The "two entry points → one pipeline" idea called out on the flow diagram above.

---

## 3. How the main components are built

The system is the **9 components** from `DESIGN.md`. The ones that carry the product:

### Convention config — "what good means" (component 2)
The manager writes the team's standard as **templated markdown**, **layered**
org → team → repo, and the engine **merges** all three layers for each PR's
author. Docs are **versioned**: a review references the rules *as they were when
it ran*, so old reviews stay coherent after the manager edits conventions.
→ `src/server/conventions/merge.ts`, `src/server/db/conventions.ts`

### Review Engine — the AI brain (component 3)
A small, discrete-step pipeline (`src/server/review/pipeline.ts`) so future
features slot in cleanly:

1. **Gather context** — the diff, the merged convention docs, and the junior's
   recent history of past mistakes.
2. **Review** — produce structured comments. Convention-grounded: every comment
   maps to a rule, no hallucinated opinions. The model assigns **severity** + **confidence**.
3. **Gates** — confidence threshold (~0.7) and a nit budget decide what actually posts.
4. **Repeat detection** — match new comments against the junior's history.
5. **Grade** — compute the per-PR metrics.

The reviewer is an **interface** with two implementations — `FakeReviewer`
(offline) and `AnthropicReviewer` (Claude) — chosen by a `factory` based on env.
That's why the system is fully testable offline.

#### How we actually steer the AI (the cool part)

The Claude reviewer (`src/server/review/anthropic-reviewer.ts`) is not "ask the
model what it thinks." It's deliberately constrained:

- **A strict system prompt** sets the persona ("a senior engineer mentoring a
  junior"), the tone ("encouraging but honest"), and one hard rule: *explain WHY
  it matters in a way a junior can learn from*. It's told **"Only flag real issues
  — do not invent problems. Prefer fewer, high-value comments."**
- **Structured output, validated.** The model must return a JSON object of a fixed
  shape. We then parse it through the **exact same Zod schema** the rest of the
  app uses (`ReviewResultSchema.parse(...)`) — if the model returns a bad shape, it
  throws. No free-form prose leaks into the product.
- **Context is injected, not assumed.** The user prompt is assembled from the PR
  title, the merged team conventions, the junior's recent mistake categories, and
  the diff. The history line literally says *"if you see the same kind of issue
  again, mention that it's a recurring pattern."*

```ts
// Every comment the engine emits is validated against this — the why is mandatory.
export const ReviewCommentSchema = z.object({
  filePath: z.string().min(1),
  lineStart: z.number().int().nonnegative(),
  lineEnd: z.number().int().nonnegative(),
  category: z.enum(CATEGORIES),     // bug | security | design | test | convention | readability | naming
  severity: z.enum(SEVERITIES),     // blocker | major | minor | nit
  confidence: z.number().min(0).max(1),
  message: z.string().min(1),
  why: z.string().min(1),           // ← the mentoring. Not optional.
  suggestion: z.string().optional(),
  conventionRef: z.string().optional(),
});
```

### Comment + Grading model — keeping 3 layers distinct (component 4)

```mermaid
flowchart TB
  subgraph L1["Layer 1 — the COMMENT (about the code)"]
    C["location · category · severity · confidence<br/>message · <b>why</b> · suggestion · conventionRef · repeat_of"]
  end
  subgraph L2["Layer 2 — auto-post GATES (no human in the loop)"]
    G["confidence threshold · nit budget · 👎 'this was wrong'"]
  end
  subgraph L3["Layer 3 — the GRADE (about the person, over time)"]
    P["issue density · repeat-mistake rate · category mix"]
  end
  L1 --> L2 --> L3
```

- **Layer 1 (the comment, about the code):** `location`, `category`, `severity`
  (blocker/major/minor/nit), `confidence`, `message`, and a **mandatory `why`**
  (the mentoring), plus optional `suggestion`, `convention_ref`, `repeat_of`.
- **Layer 2 (auto-post gates, no human in the loop):** confidence threshold, nit
  budget, and a **👎 "this was wrong"** feedback capture.
- **Layer 3 (the grade, about the person over time):** a *small profile*, not a
  single 0–100 score — **issue density**, **repeat-mistake rate**, **category mix**.
  *Severity describes the code, never the person.*

### Data model / storage (component 6)
Postgres via Prisma. Core entities: Org → Team → User, Repo, ConventionDoc,
PullRequest, Review (one row per *run*), Comment, CommentFeedback, and the frozen
**PRMetrics** snapshot (see the ER diagram above).

📷 *Suggested visuals:*
- The layered conventions tree as it appears in the app (shown in §5).
- A close-up of the system prompt next to one real JSON comment it produced.

---

## 4. A real review, end to end (worked example)

The whole product becomes obvious with one concrete PR. Here is an actual review
from the running demo — Norm Scully's messy PR — captured straight from the app.

**The diff under review** (a few deliberately bad lines):

```diff
+++ b/another-smelly.ts
+const apiKey = "sk-live-secret123";
+try { doThing(); } catch (e) {}
+console.log(value);
+let data: any = fetchData();
+// TODO: handle the edge case
```

**What the engine produced** — six structured comments, each with a severity,
category, confidence, and the mandatory *why*:

![PR detail page with full review comments](docs/screenshots/04-pr-detail.png)

Notice what's happening on this one screen:
- A **`blocker`** (hard-coded secret, 92% confidence) sits above a **`major`**
  (empty catch swallows errors) above **`minor`/`nit`** items — severity describes
  the *code*.
- Every comment carries a **`why`** and most carry a concrete **suggestion** and a
  **convention reference** ("Security", "Language specifics", "Code style").
- Several are flagged **`repeat`** — the engine recognised these as patterns this
  junior has hit before. That's the memory.

**And it rolls up into the person's growth.** The same data feeds the junior's
profile. Here's Elyan, the "improving" story — issue density falls from **12 → 0**
and you can read the trajectory at a glance:

![Per-junior profile showing improvement](docs/screenshots/02-junior-profile-elyan.png)

> This is the payoff slide: *one PR's comments* and *a person's trend* are the same
> data, just aggregated. Catching the bug is table stakes; showing the growth is
> the product.

---

## 5. The website — what you can do there

The dashboard is built with the **Next.js App Router**. It's a real,
**interactive** app — everything drills down, nothing is a static chart. Sign in
(a cookie session stands in for GitHub OAuth in the demo) as a **manager** or a
**junior**; roles and org-scoping are real.

| Page | What you can do |
|------|------------------|
| **Home** (`/`) | Entry point → "Go to the dashboard". |
| **Login** (`/login`) | Demo "sign in as" a manager or junior. |
| **Team overview** (`/dashboard`) | Manager view: stat strip (mentored juniors, reviews run, avg density, open blockers+majors), a **needs-attention** callout, the roster, and a severity breakdown. |
| **Per-junior profile** (`/dashboard/juniors/[id]`) | Density & repeat-rate trends, category breakdown, and the **top recurring mistakes** widget. |
| **All-PRs view** (`/dashboard/prs`) | A pie of PRs per junior + a histogram of PRs per day, then a **searchable, sortable** table (newest-first; click any column to re-sort; search by title/junior/repo). |
| **PR detail** (`/dashboard/prs/[id]`) | The PR header, the review summary, and **every comment** with full Layer 1 data. Re-reviewed PRs show every run, newest first. |
| **Manage Conventions** (`/dashboard/manage-conventions`) | A directory-tree editor (org → team → repo); saving writes a new version, never mutates. |
| **Review a PR** (`/dashboard/review`) | Paste a diff and run a **real review on demand** — the live demo button. |

**The team overview** — the manager's landing page, with the at-a-glance roster
and the needs-attention list (note Norm trending worse, Raz stuck repeating):

![Team overview](docs/screenshots/01-team-overview.png)

**The all-PRs view** — a pie of PRs per junior, a histogram per day, and a
searchable/sortable table that links into every PR:

![All PRs view](docs/screenshots/03-all-prs.png)

**Manage conventions** — the layered org → team → repo tree; saving writes a new
version so past reviews stay coherent:

![Manage conventions tree](docs/screenshots/05-manage-conventions.png)

**Interactivity highlights:**
- Trend charts show each point's date + value on hover; **clicking a point opens
  the PR behind it**.
- Category / mistake bars **expand on click** to list the contributing comments,
  each linking to its PR.
- Reusable client components: interactive `LineChart`, `BarList`, `PieChart`,
  `Histogram`, and a generic sortable/searchable table — each with its own tests.

📷 *Suggested live demo:* a short GIF hovering a trend point, then clicking
through to a PR — proves the "everything drills down" claim on stage.

---

## 6. How the review flow works

**Trigger →** a junior opens a PR (or pushes new commits), *or* a manager pastes a
diff into **Review a PR**. Both paths converge on one shared review service.

```mermaid
flowchart TB
  T1["Junior opens / pushes a PR"] --> RECV
  T2["Manager pastes a diff in 'Review a PR'"] -. inline .-> GATHER
  RECV["1. Receive & filter<br/>verify signature · skip drafts/non-juniors · key off commit SHA"] --> ENQ
  ENQ["2. Enqueue in pg-boss → worker picks it up"] --> GATHER
  GATHER["3. Gather context<br/>diff + merged conventions + junior history"] --> REVIEW
  REVIEW["4. Review with AI<br/>Claude or FakeReviewer → structured comments"] --> GATE
  GATE["5. Gate<br/>confidence threshold + nit budget"] --> REPEAT
  REPEAT["6. Detect repeats<br/>match against history → repeat_of"] --> GRADE
  GRADE["7. Grade<br/>density · repeat-rate · category mix → FROZEN snapshot"] --> STORE
  STORE["8. Store<br/>Review run + Comments + PRMetrics, org-scoped"] --> POST
  POST["9. Post to GitHub<br/>ONE batched review event = one notification"] --> REFLECT
  REFLECT["10. Reflect<br/>dashboards read it instantly"]
```

1. **Receive & filter.** The webhook hits `/api/github/webhook`. We verify the
   signature, skip draft PRs and non-junior authors, and key the work off the
   **commit SHA** for idempotency. (The manual trigger skips straight to step 3,
   running inline for an instant result.)
2. **Enqueue.** Webhook work goes into **pg-boss** so delivery stays fast; the
   **worker** picks it up. Both paths now converge on the same review service.
3. **Gather context.** Pull the diff, merge the author's org + team + repo
   convention layers (at their current versions), and load the junior's recent
   comment history.
4. **Review (AI).** The reviewer (`FakeReviewer` offline, or Claude with a key)
   produces structured, convention-grounded comments — each with severity,
   confidence, and a mandatory **why**.
5. **Gate.** Confidence threshold + nit budget decide what's worth posting; the
   rest is summarized so the junior isn't buried.
6. **Detect repeats.** New comments are matched against the junior's history and
   linked via `repeat_of` — the mentoring memory.
7. **Grade.** Compute the per-PR metrics (density, repeat-rate, category mix) over
   *all* comments found, and **freeze them as an immutable snapshot**.
8. **Store.** Persist the Review run, all Comments, and the PRMetrics snapshot
   (org-scoped) in Postgres.
9. **Post.** Push all inline comments + the summary back to GitHub as a **single
   batched review event** under the App's bot identity → one notification.
10. **Reflect.** The dashboards read from Postgres, so the new review immediately
    shows up in the junior's trends, the team view, and the all-PRs list.

> **v1 scope notes:** re-review covers only the *new* changes; no self-check pass
> yet; repeat-detection works within a category. All three are architected to slot
> in later (fix-acknowledgment, a self-check pass, smarter semantic matching).

📷 *Suggested visual:* a screenshot of the final batched review as it appears on a
real GitHub PR (inline comments + summary, posted by the bot).

---

## 7. What makes it different

There are plenty of AI code reviewers (CodeRabbit, Copilot review, Graphite, etc.).
They review **a pull request**. Tech Lead AI reviews **a developer**.

| Most AI reviewers | Tech Lead AI |
|---|---|
| Stateless — each PR reviewed in isolation | **Remembers the junior** — detects repeated mistakes across PRs |
| Output is comments to act on now | Output is comments **plus a growth trajectory** over time |
| A gate on the way to merge | A **mentor** — visible to the junior, framed as growth, no merge-blocking |
| Generic best-practice opinions | Grounded in **your team's own versioned conventions** |
| Ranks / scores developers | **No leaderboard, ever** — you vs. your own past only |

The wedge is **memory + mentoring**, not "another linter with an LLM." That's the
one slide a skeptical audience needs.

---

## 8. Extra things worth highlighting

- **Mentoring memory is the whole point.** "Progress = issue density ↓ *and*
  repeat-rate ↓ while task difficulty holds or rises." The product measures a
  *trajectory*, not a snapshot.
- **The insight loop.** When a mistake recurs across the *whole team*, the system
  surfaces it as a candidate to add to the conventions doc — the tool improves the
  team's standard, not just individual PRs.
- **One batched review event.** All inline comments + the summary post as a
  *single* GitHub review → one notification, not comment spam.
- **Only designated juniors are reviewed.** The manager marks who's mentored;
  everyone else's PRs are ignored. Controls cost and keeps the tool purposeful.
- **Metrics measure the work, not the show.** Grades are computed over *all*
  comments found — not just the ones that passed the gates and got posted. We never
  flatter the numbers by hiding low-confidence findings.
- **HR-sensitive by nature.** These are durable performance judgments about named
  employees, so retention, per-user deletion, and clear ownership are explicit
  design concerns before any SaaS launch.
- **Exemplary code on purpose.** It's a mentoring product, so the codebase holds
  itself to the same bar: small focused files, lots of tests (55+ passing), and a
  living `STRUCTURE.md` map.

---

## 9. Risks & honest tradeoffs

We hold these consciously rather than pretending they don't exist:

1. **Trust under full automation.** There's no human gate before a comment posts.
   The safety net is three layers working together: a **confidence threshold**, a
   **nit budget**, and the junior's **👎 "this was wrong"** signal (under full
   automation that thumbs-down is the *only* signal the AI erred). The planned
   reinforcement is a **self-check pass**.
2. **Convention quality caps review quality.** The review is only as good as the
   team's written conventions. We fight this with the **templated** convention
   format — concrete good/bad examples produce far better reviews than vague
   prose.
3. **HR-sensitive data.** Durable judgments about named employees demand a
   retention policy, per-user deletion, and clear data ownership (the company's,
   not the builder's) before going SaaS.

> Naming the hard parts is the point — it reads as engineering maturity, and each
> risk already has a designed mitigation.

---

## 10. Roadmap — what's next

The MVP is built and verified. The pipeline was deliberately staged so these slot
in without a rewrite:

- **Self-check pass** in the engine — the biggest quality lever once auto-posting.
- **Fix-acknowledgment on re-review** — "✅ you fixed this" instead of silence.
- **Notifications** — a manager weekly digest + an alert when a junior regresses
  or gets stuck.
- **Smarter semantic repeat-detection** — recognise "the same mistake" across
  different files/wording, not just within a category.
- **Pick & tune the production Claude model** and harden the review prompt.
- **The SaaS path** — the multi-tenant foundation (`org_id` everywhere) is already
  in place; add real GitHub OAuth, retention/deletion, and billing.

---

## 11. Closing & quick facts

**Tech Lead AI turns code review from a one-off gate into a mentoring relationship
that compounds.** Catch the bug, explain the why, remember the pattern, show the
growth.

**Quick facts for Q&A:**
- **Stack:** TypeScript, Next.js (App Router), Postgres (Docker), Prisma, pg-boss,
  Anthropic SDK, Octokit (GitHub App), Vitest.
- **Status:** MVP built — 55+ tests pass, app builds & typechecks; live GitHub path
  wired (GitHub App `4126235`).
- **Runs offline:** no API key → `FakeReviewer`; add a key → Claude. The demo can't
  fail on stage.
- **Reviewed users:** only manager-designated juniors (controls cost, keeps it
  purposeful).
- **Safety nets under automation:** confidence threshold + nit budget + the 👎 signal.

*Built as the MVP described in [DESIGN.md](DESIGN.md) and [MVP.md](MVP.md).
Screenshots in [docs/screenshots/](docs/screenshots) are captured from the running
demo (regenerate with `scripts/shots.mjs`).*
