import { PrismaClient } from "@prisma/client";

/**
 * Single shared Prisma client. In dev, Next.js hot-reloads modules, which would
 * otherwise open a new connection pool on every reload — so we cache it on the
 * global object.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
