import { prisma } from "@/server/db/client";
import type { AddJuniorStore } from "./add-junior";

/**
 * Prisma-backed `AddJuniorStore`. A thin adapter over the database — the real
 * logic and its tests live in `add-junior.ts`. Every write carries `org_id`
 * (multi-tenant, see CLAUDE.md).
 */
export const prismaAddJuniorStore: AddJuniorStore = {
  async existsByLogin(orgId, githubLogin) {
    const existing = await prisma.user.findUnique({
      where: { orgId_githubLogin: { orgId, githubLogin } },
    });
    return existing !== null;
  },

  async createJunior(orgId, junior) {
    const created = await prisma.user.create({
      data: {
        orgId,
        role: "junior",
        githubLogin: junior.githubLogin,
        name: junior.name,
        teamId: junior.teamId,
        isMentoredJunior: true,
      },
    });
    return { id: created.id };
  },
};
