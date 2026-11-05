import type { PrismaClient, Prisma } from "@visionlight/database";

export async function audit(
  prisma: PrismaClient,
  entry: { action: string; userId?: string; organizationId?: string; ip?: string; metadata?: Prisma.InputJsonValue },
) {
  await prisma.auditLog.create({ data: entry });
}
