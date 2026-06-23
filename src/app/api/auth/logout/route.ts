import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/server/auth/session";

export async function POST(req: NextRequest) {
  await clearSession();
  return NextResponse.redirect(new URL("/login", req.url));
}
