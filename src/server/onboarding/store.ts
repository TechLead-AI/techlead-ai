import { prisma } from "@/server/db/client";
import type { OnboardStore } from "./onboard";

/**
 * Prisma-backed `OnboardStore`. A thin adapter over the database — the real
 * logic and its tests live in `onboard.ts`. Every write carries `org_id`
 * (multi-tenant, see CLAUDE.md).
 */
export const prismaStore: OnboardStore = {
  async findOrCreateOrg(name) {
    const existing = await prisma.org.findFirst({ where: { name } });
    if (existing) return { id: existing.id, name: existing.name };
    const created = await prisma.org.create({ data: { name } });
    return { id: created.id, name: created.name };
  },

  async upsertRepo(orgId, fullName) {
    const existing = await prisma.repo.findUnique({
      where: { orgId_fullName: { orgId, fullName } },
    });
    if (existing) return { id: existing.id, created: false };
    const created = await prisma.repo.create({ data: { orgId, fullName } });
    return { id: created.id, created: true };
  },

  async upsertJunior(orgId, login) {
    const existing = await prisma.user.findUnique({
      where: { orgId_githubLogin: { orgId, githubLogin: login } },
    });
    if (!existing) {
      await prisma.user.create({
        data: {
          orgId,
          role: "junior",
          githubLogin: login,
          name: login,
          isMentoredJunior: true,
        },
      });
      return { created: true, promoted: false };
    }
    if (!existing.isMentoredJunior) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { isMentoredJunior: true },
      });
      return { created: false, promoted: true };
    }
    return { created: false, promoted: false };
  },
};
