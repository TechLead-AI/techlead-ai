import { NextRequest, NextResponse } from "next/server";
import { setSession } from "@/server/auth/session";

/** Demo login: pick a user id, set the session cookie, go to the dashboard. */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const userId = String(form.get("userId") ?? "");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  await setSession(userId);
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
