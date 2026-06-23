import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { saveConvention } from "@/server/db/conventions";
import type { ConventionScope } from "@/server/conventions/merge";

const SCOPES = ["org", "team", "repo"] as const;

/** Save a convention layer (creates a new version), then return to the editor. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  // Editing conventions is a manager/admin action.
  if (user.role === "junior") {
    return NextResponse.json({ error: "Managers only" }, { status: 403 });
  }

  const form = await req.formData();
  const scope = String(form.get("scope") ?? "") as ConventionScope;
  const markdown = String(form.get("markdown") ?? "");
  const teamId = form.get("teamId") ? String(form.get("teamId")) : null;
  const repoId = form.get("repoId") ? String(form.get("repoId")) : null;

  if (!SCOPES.includes(scope)) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  await saveConvention({ orgId: user.orgId, scope, teamId, repoId, markdown });

  return NextResponse.redirect(
    new URL("/dashboard/manage-conventions", req.url),
    303,
  );
}
