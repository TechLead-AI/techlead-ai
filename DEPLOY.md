# DEPLOY.md — Deploy Tech Lead AI to Railway

This guide takes the project from the local demo to a **live, publicly reachable
deployment** on [Railway](https://railway.app): a public web app, a background
review worker, and a managed Postgres — all from this one repo.

## What gets deployed

This repo runs as **three services** that share one `DATABASE_URL`:

```
                 ┌──────────────────────────────────────────────┐
GitHub PR event ─┼─▶ Web service (npm start)                     │
                 │     • dashboards + login                      │
                 │     • POST /api/github/webhook  ──enqueue──┐  │
                 │                                            │  │
                 │   Postgres ◀── data + pg-boss queue ───────┤  │
                 │                                            │  │
                 │   Worker service (npm run worker) ◀────────┘  │
                 │     • runs the review pipeline                │
                 │     • posts the review back to GitHub         │
                 └──────────────────────────────────────────────┘
```

- **Web** is the only service with a public URL. It serves the dashboards **and**
  receives the GitHub webhook.
- **Worker** has no public URL. It watches the Postgres queue and does the
  reviewing + posting.
- **Postgres** is Railway's managed plugin; it backs both the data model and the
  pg-boss job queue (no Redis).

> **No smee in production.** smee only exists to tunnel webhooks to `localhost`
> during local dev. Once the web service has a real `https://…` URL, GitHub calls
> it directly — you stop running the smee forwarder entirely (see Step 6).

---

## What the repo already does for you

These are wired up in `package.json` so deploys are hands-off:

- **`postinstall: prisma generate`** — both services generate the Prisma client
  on every install.
- **`release: prisma migrate deploy`** — applies pending migrations against the
  production database (idempotent; set as the web service's **pre-deploy
  command** in Step 4).
- **`tsx`, `dotenv`, `prisma` are runtime dependencies** — so the worker process
  and the migration step keep working even if dev dependencies are pruned.

---

## Prerequisites

- A [Railway](https://railway.app) account.
- The GitHub repo (`TechLead-AI/techlead-ai`) pushed and accessible.
- Your `ANTHROPIC_API_KEY` (optional — without it the offline `FakeReviewer`
  runs).
- The GitHub App credentials from `CONNECT_GITHUB.md` (App ID, private key,
  webhook secret) — needed only for the live GitHub flow.

---

## Step 1 — Create the project and add Postgres

1. Railway → **New Project → Deploy from GitHub repo** → pick
   `TechLead-AI/techlead-ai`.
2. In the project, **New → Database → Add PostgreSQL**.

Railway exposes the database connection string as a variable you can reference
from the other services as `${{Postgres.DATABASE_URL}}` (see Step 3).

---

## Step 2 — Create the two app services

The repo import in Step 1 creates one service. You need **two** services pointed
at the same repo:

| Service | Build command | Start command | Public URL? |
|---|---|---|---|
| **web** | `npm run build` (default) | `npm start` | **Yes** — generate a domain |
| **worker** | `npm run build` (default is fine) | `npm run worker` | No |

To add the second service: **New → GitHub Repo → same repo**, then in its
**Settings → Deploy** set the **Start Command** to `npm run worker`.

For the **web** service, open **Settings → Networking → Generate Domain** to get
a public `https://<something>.up.railway.app` URL. Note it — you'll need it for
the GitHub App webhook in Step 6.

---

## Step 3 — Set environment variables (both services)

Set these on **both** the web and worker services (Variables tab). The simplest
path is to define them once and use Railway's shared/reference variables.

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Reference the Postgres plugin. Required by both. |
| `ANTHROPIC_API_KEY` | `sk-ant-…` | Leave blank to use the offline `FakeReviewer`. |
| `REVIEW_MODEL` | `claude-sonnet-4-6` | Which Claude model the reviewer uses. |
| `GITHUB_APP_ID` | `123456` | From the GitHub App settings page. |
| `GITHUB_WEBHOOK_SECRET` | `the-secret-from-the-App` | Must match the App's webhook secret exactly. |
| `GITHUB_APP_PRIVATE_KEY` | `-----BEGIN…\n…\n-----END…\n` | The `.pem` on one line with literal `\n` between lines (same format as local `.env`). |

Notes:
- The **web** service needs `DATABASE_URL` + `GITHUB_WEBHOOK_SECRET` (to receive
  and verify webhooks).
- The **worker** service needs `DATABASE_URL` + `ANTHROPIC_API_KEY` +
  `REVIEW_MODEL` + `GITHUB_APP_ID` + `GITHUB_APP_PRIVATE_KEY` (to review and post
  back).
- Setting the full set on both is the easy, safe default.

---

## Step 4 — Run migrations automatically on deploy

On the **web** service: **Settings → Deploy → Pre-Deploy Command** →
`npm run release`.

This runs `prisma migrate deploy` against the production Postgres before each new
version goes live, so the schema is always current. It's idempotent — safe to run
on every deploy. (Set this on **one** service only — the web service — so two
services don't race to migrate.)

---

## Step 5 — Deploy and seed

1. Trigger a deploy (Railway auto-deploys on push to the connected branch, or use
   **Deploy** in the dashboard).
2. Watch both services' build + deploy logs. The web service's pre-deploy step
   should report the migrations applying.
3. **(Optional) Seed demo data** so the dashboards aren't empty for a
   presentation. From your machine, run the seed against the production database:

   ```bash
   DATABASE_URL="<the production DATABASE_URL from Railway>" npm run db:seed
   ```

   Grab the value from the Postgres service's **Connect** tab (use the public
   connection string). Skip this if you only want real GitHub-driven data.

Open the web service's public URL — the dashboards should load.

---

## Step 6 — Point the GitHub App at the live URL (drop smee)

In the GitHub App settings (see `CONNECT_GITHUB.md` for creating it):

1. **Webhook URL** → `https://<your-web-domain>.up.railway.app/api/github/webhook`
2. Confirm **Webhook secret** matches `GITHUB_WEBHOOK_SECRET` from Step 3.
3. Make sure the App is **installed** on the repo(s) you want reviewed.
4. **Stop running the smee forwarder** — it's no longer needed.

Register the repo and its mentored juniors against the production database (same
script as local, pointed at prod):

```bash
DATABASE_URL="<production DATABASE_URL>" npm run onboard -- \
  --org "Colman" \
  --repo "your-org/your-repo" \
  --juniors "alice, bob"
```

---

## Step 7 — Verify the live flow

1. Open or push to a PR authored by a registered junior on the installed repo.
2. The GitHub App's **Recent Deliveries** tab shows the webhook hitting your
   Railway URL and the response `outcome` (`queued`, `ignored_action`,
   `unknown_repo`, `not_mentored_junior`).
3. The **worker** service logs show the job being consumed and the review posted.
4. The review appears on the PR, and a new entry shows up in the dashboard.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Web build fails on `prisma` | `postinstall` didn't run — confirm `prisma` is in `dependencies` and the install step ran. |
| Migrations never apply | Pre-deploy command not set to `npm run release` on the web service. |
| Worker crashes on start | `DATABASE_URL` missing on the worker, or `tsx`/`dotenv` not installed (must be in `dependencies`). |
| Webhook returns **503** | `GITHUB_WEBHOOK_SECRET` not set on the **web** service. |
| Webhook returns **401** | Secret on the web service ≠ secret configured on the GitHub App. |
| `outcome: "unknown_repo"` | Repo not registered — run the onboard script against prod. |
| Review never posts back | Worker not running, or `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` missing on the worker. |

See `CONNECT_GITHUB.md` for the GitHub App creation details and the full live
review flow.
