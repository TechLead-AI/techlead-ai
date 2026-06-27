# STRUCTURE.md — Codebase map

> The navigation map of this repository. Update it in the same change whenever a
> file or directory is added, moved, removed, or renamed (see `CLAUDE.md`).

## Top level

| Path | Purpose |
|------|---------|
| `DESIGN.md` | Product & system design — what we're building and why |
| `MVP.md` | The step-by-step build plan for the demo |
| `CONNECT_GITHUB.md` | How to connect a real GitHub repo for live PR reviews |
| `DEPLOY.md` | How to deploy the web app + worker + Postgres to Railway |
| `CLAUDE.md` | How to write code in this repo |
| `STRUCTURE.md` | This file — the codebase map |
| `PRESENTATION.md` | Project presentation (purpose, architecture, flow) with embedded screenshots |
| `docs/screenshots/` | Dashboard screenshots used by `PRESENTATION.md` (generated) |

## Stack

TypeScript + Next.js (App Router), Postgres via Docker Compose, Prisma ORM,
pg-boss queue, Anthropic SDK, Octokit, Vitest. See `DESIGN.md` for the rationale.

## Code layout (built)

Each module is small files with co-located `*.test.ts`.

```
/
  DESIGN.md  MVP.md  CLAUDE.md  STRUCTURE.md  README.md
  docker-compose.yml          # local Postgres (host port 5433)
  .env / .env.example         # config
  package.json  tsconfig.json  next.config.mjs
  vitest.config.ts  vitest.setup.ts
  .claude/launch.json         # preview dev-server config
  public/
    logo.png                  # brand mark shown next to the nav wordmark
  prisma/
    schema.prisma             # data model (component 6)
    migrations/               # init + add_review_summary
    seed.ts                   # realistic demo data via the real pipeline
  scripts/
    onboard-repo.ts           # CLI: register a real repo + juniors (npm run onboard)
    check-github-app.ts       # CLI: verify App credentials + list installs (npm run check:github)
    shots.mjs                 # one-off: capture dashboard screenshots for PRESENTATION.md (needs puppeteer-core + Chrome)
  src/
    app/
      page.tsx                # home
      icon.png                # favicon (auto-served by the App Router)
      error.tsx               # route error boundary (App Router requires one)
      not-found.tsx           # 404 boundary (used by notFound())
      global-error.tsx        # root-layout error boundary
      login/page.tsx          # demo sign-in (stands in for GitHub OAuth)
      dashboard/
        layout.tsx            # session guard + nav
        page.tsx              # manager: team overview (stats, attention, severity) / junior: redirect
        juniors/[id]/page.tsx # per-junior profile (component 7)
        prs/page.tsx          # all-PRs view: pie + histogram + searchable/sortable table
        prs/[id]/page.tsx     # PR detail: header + review summary + all comments
        manage-conventions/page.tsx # convention tree editor (org/team/repo)
        review/page.tsx       # manual "review a PR" form (Step 5)
      api/
        auth/login, auth/logout   # demo session cookie
        review/manual             # manual trigger endpoint
        conventions               # save a convention layer (new version)
        github/webhook            # GitHub webhook receiver (Step 6)
    components/
      charts.tsx              # interactive LineChart (axes), BarList, TrendBadge (client; + test)
      figures.tsx             # interactive PieChart + Histogram SVGs (client; + test)
      sortable-table.tsx      # generic sortable/searchable table (client; + test)
      comment-card.tsx        # renders one review comment with all Layer 1 data
      convention-editor.tsx   # one editable convention layer (collapsible form)
      icons.tsx               # inline SVG glyphs (folder, document) for the tree
      ui.tsx                  # Card, Stat, SeverityBadge, StatusBadge, Tag
    server/
      auth/session.ts         # cookie session (component 8)
      http/redirect.ts        # host-agnostic relative redirect (proxy-safe; + test)
      conventions/merge.ts    # layered convention merge (component 2)
      grading/metrics.ts      # density / repeat-rate / category mix (component 4)
      stats/pr-stats.ts       # pure PR aggregations: per-author, per-day (+ test)
      review/
        types.ts              # ReviewComment schema + severity weights
        reviewer.ts           # Reviewer interface + offline FakeReviewer
        anthropic-reviewer.ts # Claude-backed reviewer
        factory.ts            # picks fake vs Claude by env
        gates.ts              # confidence + nit-budget gates (component 4)
        repeat.ts             # repeat detection (component 3)
        pipeline.ts           # review -> gates -> repeats -> metrics
        service.ts            # gather (db) -> pipeline -> store; idempotent
        manual.ts             # manual-trigger service (Step 5)
      github/
        verify.ts             # webhook signature verification
        webhook.ts            # parse + decide + process events (components 1)
        client.ts             # Octokit + batched-review payload (components 1,5)
        post.ts               # post a stored review back to GitHub
      onboarding/
        onboard.ts            # register a real repo + mentored juniors (+ test)
        store.ts              # Prisma adapter for the onboarding orchestration
      queue/
        jobs.ts               # job data + shared handler (logs progress; + test)
        queue.ts              # pg-boss setup, enqueue, worker registration
      db/
        client.ts             # Prisma singleton
        reviews.ts            # gather context + store a review run
        dashboard.ts          # dashboard read queries: roster, profile, team stats (component 7)
        pull-request.ts       # PR list + detail read queries
        conventions.ts        # convention tree read + versioned save (component 2)
    worker/index.ts           # worker process (consumes the queue)
    lib/
      health.ts               # trivial health helper + smoke test
      format.ts               # deterministic date formatting (avoids hydration drift)
```

Not yet built (deferred — see MVP.md "After the MVP"): self-check pass,
fix-acknowledgment, notifications, smarter semantic repeat-detection.
