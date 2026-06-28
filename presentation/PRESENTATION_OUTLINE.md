# Tech Lead AI — Presentation Outline

> Brief for an AI slide-builder. Keep it simple, visual, and easy to follow.
> One idea per slide. Plain English. Audience: technical + product people.
> Tone: confident, clear, a little bit of personality.

---

## Slide 1 — The Problem

**Title:** Training juniors is expensive senior time.

- Senior engineers spend a huge amount of time training new junior developers.
- "Training a junior" really means one thing: **helping them get better at writing code.**
- That happens through code review — but good review is slow, manual, and the
  first thing dropped when seniors are busy.

*Visual:* a tired senior buried in PRs vs. a junior waiting for feedback.

---

## Slide 2 — What exists today

**Title:** AI code review already exists — but it has no memory.

- The closest thing today is asking an AI to do a code review (CR).
- It only gives **point-in-time comments about one specific PR.**
- It forgets the developer the moment the PR closes. No history, no growth,
  no sense of whether this person is actually improving.

*Visual:* one PR with comments, then a trash can — the context is thrown away.

---

## Slide 3 — Our Solution

**Title:** We mentor the developer, not just the pull request.

- Tech Lead AI runs the **whole mentoring loop** for each junior, over time.
- It remembers **every comment a developer has ever received**, across all their PRs.
- When a new PR comes in, it uses that personal history to:
  - spot **repeated mistakes** ("you've hit this pattern before"),
  - track whether they are **getting better**,
  - give feedback **tuned to that person's growth**, not just the diff in front of it.
- In short: we build a **personal mentoring context for every developer** — and
  every review makes that context richer.

> The one-liner: *Every other AI reviewer reviews a PR. We mentor a person.*

*Visual:* a timeline of one junior's PRs feeding into a single "memory" that
shapes the next review.

---

## Slide 4 — This is us

**Title:** Tech Lead AI

- Team / product name: **Tech Lead AI**.
- Put a **QR code + tinyURL** here so people can open the live app on their phones.

*Visual:* big logo, QR code, short URL.

---

## Slide 5 — The product (screenshot + 3 features)

**Title:** What you can actually do in the app.

Show a screenshot of the dashboard, then highlight **three features**:

1. **Track every junior** — see each developer's growth over time: are their
   issues going down? Are they still repeating the same mistakes?
2. **Spot blockers fast** — a clear view of PRs that carry blocking issues, so a
   tech lead knows exactly where to look first.
3. **Team conventions** — managers write "what good code looks like" for their
   team, and every review is grounded in those rules (not generic opinions).

*Visual:* one clean dashboard screenshot with three callouts.

---

## Slide 6 — Architecture (diagram)

**Title:** How it's built.

Show one simple diagram:

```
GitHub PR  ──webhook──▶  Web app (/api/github/webhook)  ──enqueue──▶  Queue (pg-boss on Postgres)
                                                                          │
                                                                          ▼
                                                                    Review Worker
                                                                          │
                                          ┌───────────────────────────────┤
                                          ▼                               ▼
                              Claude / rule-based reviewer            Postgres (Prisma)
                                          │                               ▲
                                          └── posts one batched review ───┘
                                              back to GitHub          Dashboards read from here
```

Key points to say out loud:
- **The webhook never waits on the AI.** GitHub gets an instant response — we
  just drop the job on the queue and return. Nothing times out, nothing blocks.
- **Postgres pulls double duty.** It's both our database *and* our job queue
  (pg-boss) — one piece of infrastructure to run, no Redis, less to operate.
- **Workers are independent and stateless.** Need more throughput? Run more
  workers. Scaling is literally "add another one."
- **Exactly-once reviews.** GitHub retries webhooks a lot; we key off the commit
  SHA so a commit is reviewed once — never duplicate comments.

*Visual:* the diagram above, cleaned up.

---

## Slide 7 — Interesting technical challenges

**Title:** Two things we're proud of under the hood.

**1. Built to scale out across many workers.**
- Reviews are expensive (AI calls), so we never run them inside the web request.
- They go onto a **queue (pg-boss, running on our existing Postgres — no Redis)**,
  and a separate **worker** process picks them up.
- If load grows, we can **add more workers** to spread the work — the
  architecture already supports it, and we cap how many expensive reviews run at
  once.

**2. A zero-token rule-based scanner alongside the AI.**
- We pair the AI with a **rule-based static scanner** that catches common smells
  (hard-coded secrets, empty catch blocks, `any`, leftover TODOs, etc.)
  **without spending any tokens.**
- It pre-filters the cheap, obvious issues and feeds concrete examples into the
  AI prompt — so we **only spend tokens where the AI actually adds value.**
- It produces the same structured comment shape as the AI, so the rest of the
  system doesn't care which one ran.

*Visual:* left = queue + many workers; right = "rules first, AI second" funnel.

---

## Slide 8 — Demo

**Title:** Demo

*(Intentionally empty — placeholder slide for the live demo.)*

---

## Slide 9 — Summary / Punch line

**Title:** We turn code review into mentoring that compounds.

- We **save time for juniors and their tech leads** — feedback is instant and consistent.
- We **save the management overhead** of holding all that context in someone's head —
  the system remembers each developer's history for you.
- We **shorten onboarding and training** — juniors improve faster because the
  feedback is personal, repeated, and tracked.

> Punch line: *Catch the bug, explain the why, remember the pattern, show the growth.*

*Visual:* before/after — scattered one-off comments vs. a rising growth curve.
