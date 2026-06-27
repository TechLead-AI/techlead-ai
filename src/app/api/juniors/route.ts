import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { addJunior } from "@/server/juniors/add-junior";
import { prismaAddJuniorStore } from "@/server/juniors/store";
import { relativeRedirect } from "@/server/http/redirect";

/** Handle the "Add junior" form. Admins and managers only. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return relativeRedirect("/login");
  // Gate server-side: juniors must never reach this, even by hitting the URL.
  if (user.role !== "manager" && user.role !== "admin") {
    return NextResponse.json({ error: "Managers only" }, { status: 403 });
  }

  const form = await req.formData();
  const name = String(form.get("name") ?? "");
  const githubLogin = String(form.get("githubLogin") ?? "");
  const teamId = String(form.get("teamId") ?? "") || null;

  try {
    const junior = await addJunior(prismaAddJuniorStore, user.orgId, {
      name,
      githubLogin,
      teamId,
    });
    return relativeRedirect(`/dashboard/juniors/${junior.id}`);
  } catch (e) {
    // Send the failure back to the form so it can be shown inline.
    const message = e instanceof Error ? e.message : "Could not add junior.";
    return relativeRedirect(
      `/dashboard/add-junior?error=${encodeURIComponent(message)}`,
    );
  }
}
