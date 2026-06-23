import { NextRequest, NextResponse } from "next/server";
import { verifySignature } from "@/server/github/verify";
import {
  parsePullRequestEvent,
  processPullRequestEvent,
} from "@/server/github/webhook";
import { fetchPrDiff } from "@/server/github/client";
import { enqueueReview } from "@/server/queue/queue";

/**
 * GitHub App webhook receiver (DESIGN.md Step 6). Verifies the signature, then
 * for pull_request events resolves the org/junior, fetches the diff, and
 * enqueues a review. The worker posts the result back.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  }
  if (!verifySignature(secret, raw, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  if (req.headers.get("x-github-event") !== "pull_request") {
    return NextResponse.json({ outcome: "ignored_event" });
  }

  const event = parsePullRequestEvent(JSON.parse(raw));
  if (!event) return NextResponse.json({ outcome: "unparseable" });

  const outcome = await processPullRequestEvent(event, {
    fetchDiff: fetchPrDiff,
    enqueue: enqueueReview,
  });
  return NextResponse.json({ outcome });
}
