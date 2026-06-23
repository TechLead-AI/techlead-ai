import { cookies } from "next/headers";
import { prisma } from "@/server/db/client";

/**
 * Minimal session for the local demo: a cookie holding the logged-in user id.
 * This stands in for GitHub OAuth (Step 6 replaces the login step with the real
 * OAuth flow; everything downstream — org scoping, roles — stays the same).
 */
const COOKIE = "tlai_uid";

export type SessionUser = {
  id: string;
  orgId: string;
  role: "manager" | "junior" | "admin";
  name: string;
  githubLogin: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const uid = (await cookies()).get(COOKIE)?.value;
  if (!uid) return null;
  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user) return null;
  return {
    id: user.id,
    orgId: user.orgId,
    role: user.role,
    name: user.name,
    githubLogin: user.githubLogin,
  };
}

export async function setSession(userId: string): Promise<void> {
  (await cookies()).set(COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
