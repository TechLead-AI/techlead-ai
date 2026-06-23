import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { runManualReview } from "@/server/review/manual";

/** Handle the "Review a PR" form: run a review, then go to the junior's profile. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  if (user.role === "junior") {
    return NextResponse.json({ error: "Managers only" }, { status: 403 });
  }

  const form = await req.formData();
  const authorId = String(form.get("authorId") ?? "");
  const repoId = String(form.get("repoId") ?? "");
  const title = String(form.get("title") ?? "Untitled PR");
  const diff = String(form.get("diff") ?? "");

  if (!authorId || !repoId || !diff.trim()) {
    return NextResponse.json(
      { error: "authorId, repoId and diff are required" },
      { status: 400 },
    );
  }

  const result = await runManualReview({
    orgId: user.orgId,
    authorId,
    repoId,
    title,
    diff,
  });

  return NextResponse.redirect(
    new URL(`/dashboard/juniors/${result.authorId}`, req.url),
  );
}
