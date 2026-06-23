# CONNECT_GITHUB.md — Connect Tech Lead AI to a real GitHub repo

This guide takes you from the offline demo to a **live** setup where every PR
change on a real repo triggers a review that gets posted back to GitHub.

The code path already exists end-to-end (webhook → queue → review pipeline →
post back). What's left is configuration: create a GitHub App, point its webhook
at your running server, set three env vars, and register the repo + the juniors
you want reviewed.

## How a live review flows

```
GitHub PR event ──▶ POST /api/github/webhook ──▶ verify signature
                                              └─▶ parse pull_request event
                                              └─▶ look up repo + author in DB
                                              └─▶ fetch the PR diff (Octokit)
                                              └─▶ enqueue a review job (pg-boss)

worker process ──▶ run the review pipeline ──▶ store the review
                                           └─▶ post one batched review to GitHub
```

Two facts decide whether a PR is reviewed (see
[`src/server/github/webhook.ts`](src/server/github/webhook.ts)):

1. **The repo is registered** in the database (matched by `owner/name`).
2. **The PR author is a mentored junior** (`isMentoredJunior = true`).

Drafts are skipped. Reviewable actions are `opened`, `reopened`, `synchronize`
(a new push), and `ready_for_review`. The same commit SHA is never reviewed
twice.

---

## Prerequisites

- The local stack runs (see `README.md`): Postgres up via Docker, migrations
  applied, `npm install` done.
- An `ANTHROPIC_API_KEY` in `.env` if you want real AI reviews. Without it the
  built-in fake reviewer runs — fine for testing the wiring, but the comments
  are canned.

---

## Step 1 — Create the GitHub App

GitHub → **Settings → Developer settings → GitHub Apps → New GitHub App**.

- **Webhook → Active:** on.
- **Webhook URL:** your public webhook endpoint (Step 2 gives you one for local
  dev). It must end in `/api/github/webhook`.
- **Webhook secret:** generate a random string and keep it — this becomes
  `GITHUB_WEBHOOK_SECRET`.
- **Repository permissions:**
  - **Pull requests: Read & write** — read the diff, post the review.
  - **Contents: Read-only** — read file contents for the diff.
  - **Metadata: Read-only** — mandatory, set automatically.
- **Subscribe to events:** **Pull request**.
- **Where can this App be installed:** "Only on this account" is fine.

Create it, then on the App's page:

- Note the **App ID** → `GITHUB_APP_ID`.
- **Generate a private key** → downloads a `.pem` → `GITHUB_APP_PRIVATE_KEY`.
- **Install App** → choose the test repo(s) you want reviewed.

---

## Step 2 — Expose your local server (dev only)

GitHub must reach your webhook over the public internet. For local development,
tunnel deliveries with [smee.io](https://smee.io):

```bash
# 1. Go to https://smee.io/new and copy the channel URL — use it as the
#    App's Webhook URL above, but with the path appended:
#       https://smee.io/<channel>            <- the App's Webhook URL
#
# 2. Forward deliveries to your local Next.js server:
npx smee-client --url https://smee.io/<channel> \
  --target http://localhost:3000/api/github/webhook
```

In production, just point the App's Webhook URL at your deployed
`https://your-host/api/github/webhook` and skip smee.

---

## Step 3 — Fill in `.env`

```dotenv
GITHUB_APP_ID="123456"
GITHUB_WEBHOOK_SECRET="the-secret-from-step-1"
# Paste the whole .pem on one line, with literal \n between lines:
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n"
```

The webhook receiver returns **503** if `GITHUB_WEBHOOK_SECRET` is unset and
**401** if the signature doesn't match — so if deliveries are being rejected,
check this value first. The worker only posts back to GitHub when both
`GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` are present.

> Tip: to turn a `.pem` file into the one-line form:
> `awk 'BEGIN{ORS="\\n"} {print}' your-app.private-key.pem`

---

## Step 4 — Register the repo and its juniors

The webhook ignores any repo or author it doesn't know. Register them with the
onboarding script (idempotent — safe to re-run):

```bash
npm run onboard -- \
  --org "Colman" \
  --repo "your-org/your-repo" \
  --juniors "alice, bob, @carol"
```

- `--org` — your org's name. Created if it doesn't exist; reused if it does.
- `--repo` — the repo's `owner/name` (a full GitHub URL also works).
- `--juniors` — GitHub **logins** (not display names) of the developers whose
  PRs should be reviewed. A leading `@` is fine; separate with commas or spaces.

Each junior is created (or, if they already exist, flagged as a mentored
junior). The logic lives in
[`src/server/onboarding/onboard.ts`](src/server/onboarding/onboard.ts).

---

## Step 5 — Run the server and the worker

The webhook enqueues work; a separate **worker** runs the pipeline and posts the
review back. Both must be running:

```bash
npm run dev      # terminal 1 — Next.js (serves /api/github/webhook)
npm run worker   # terminal 2 — consumes the queue, posts reviews
# terminal 3 — the smee forwarder from Step 2 (local dev only)
```

---

## Step 6 — Trigger a review

Open a PR (or push a commit) authored by one of the juniors you registered, on
the installed repo. Within a minute you should see a single batched review
appear on the PR with the AI's comments, and a new entry in the dashboard.

To watch it work: the webhook response body reports an `outcome`
(`queued`, `ignored_action`, `unknown_repo`, or `not_mentored_junior`), and
smee.io shows every delivery and its response.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Deliveries return **503** | `GITHUB_WEBHOOK_SECRET` not set in `.env`. |
| Deliveries return **401** | Secret in `.env` ≠ secret on the App's webhook. |
| `outcome: "unknown_repo"` | Repo not registered — re-run `npm run onboard`. |
| `outcome: "not_mentored_junior"` | Author's login not registered as a junior, or `--juniors` used a display name instead of the GitHub login. |
| `outcome: "ignored_action"` | The PR is a draft, or the action isn't reviewable (e.g. `closed`). |
| Review never posts back | The worker isn't running, or `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` are missing. |
| Posting fails with a permission error | The App lacks **Pull requests: Read & write**, or isn't installed on that repo. |
