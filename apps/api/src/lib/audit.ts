import type { PrismaClient, Prisma } from "@visionlight/database";

export async function audit(
  prisma: PrismaClient,
  entry: { action: string; userId?: string; organizationId?: string; ip?: string; metadata?: Prisma.InputJsonValue },
) {
  await prisma.auditLog.create({ data: entry });
}

/**
 * Registra cada lectura de datos personales de clientes (correo, teléfono, nombre).
 * Toda ruta o tarea que descifre esos datos debe llamar a esta función.
 */
export async function logPersonalDataAccess(
  prisma: PrismaClient,
  entry: { organizationId: string; resource: "cart" | "order" | "visitor"; recordIds: string[]; purpose: string; userId?: string; ip?: string },
) {
  if (!entry.recordIds.length) return;
  await audit(prisma, {
    action: "personal_data.accessed",
    organizationId: entry.organizationId,
    userId: entry.userId,
    ip: entry.ip,
    metadata: { resource: entry.resource, recordIds: entry.recordIds.slice(0, 500), count: entry.recordIds.length, purpose: entry.purpose },
  });
}
