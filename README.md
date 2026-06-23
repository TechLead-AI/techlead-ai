# Tech Lead AI

Mentors junior developers by reviewing their GitHub pull requests with an AI
model, posting the reviews as PR comments, and tracking each junior's progress on
dashboards. See [DESIGN.md](DESIGN.md) for the full design and [MVP.md](MVP.md)
for the build plan.

## Run the demo locally

Prerequisites: Node 20+, Docker.

```bash
# 1. Install dependencies
npm install

# 2. Start Postgres (host port 5433)
docker compose up -d

# 3. Set up the database and generate the client
cp .env.example .env          # already present; edit if needed
npm run db:migrate            # applies migrations
npm run db:seed               # fills realistic demo data

# 4. Run the app
npm run dev                   # http://localhost:3000

# 5. (optional) Run the review worker in a second terminal
npm run worker                # consumes queued reviews (GitHub webhook path)
```

Open http://localhost:3000, click **Go to the dashboard**, and sign in as
**Shir** (the manager) to see the team view, or as a junior to see their own
growth. Use **Review a PR** to paste a diff and run a real review on demand.

The demo runs fully offline: with no `ANTHROPIC_API_KEY`, an offline
`FakeReviewer` scans the diff for common smells. Add a key (and set
`REVIEW_MODEL`) in `.env` to use Claude.

## Tests

```bash
npm test          # all unit + integration tests (needs Postgres running)
npm run typecheck # TypeScript
npm run build     # production build
```

## Troubleshooting

**"Internal Server Error" / `__webpack_modules__[moduleId] is not a function`** —
caused by a corrupted `.next` webpack cache (a production `next build` sharing
the dev `.next`, or an on-disk cache rename race). `next.config.mjs` uses an
in-memory webpack cache in dev to avoid the latter; if it still happens, clear
and restart:

```bash
npm run clean     # rm -rf .next
npm run dev
# or in one step:
npm run dev:clean
```

Don't run `npm run build` against the same checkout you're actively running
`npm run dev` in without clearing `.next` afterwards. Likewise, don't run two
`next dev` servers on the same checkout — they'd share (and corrupt) one
`.next`. A second server should use a separate build dir, e.g.
`NEXT_DIST_DIR=.next-preview next dev` (see the `dev:preview` script).

## How it fits together

```
GitHub ──webhook──▶ /api/github/webhook ──enqueue──▶ pg-boss ──▶ worker ──▶ review service ──▶ Claude / FakeReviewer
                                                                     │
   Manual "Review a PR" ─────────────────────────────────────────────┤ (same review service)
                                                                     ▼
                          Dashboards (Next.js) ◀──── reads ────▶ Postgres (Prisma)
```

The manual trigger and the GitHub webhook both call the same review service
(`src/server/review/service.ts`), so there is one pipeline, not two.

## Going live with GitHub (Step 6)

Set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_WEBHOOK_SECRET` in
`.env`, install the GitHub App on a repo, register that repo and its juniors in
the database, and point the App's webhook at `/api/github/webhook` (use a tunnel
like smee.io for local delivery). Mark which users are mentored juniors; only
their PRs are reviewed.
