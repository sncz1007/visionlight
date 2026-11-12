import type { PrismaClient } from "@prisma/client";

// Política de retención de datos (ver docs/privacidad/retencion.md).
// Cambiar un plazo aquí exige actualizar también ese documento.
export const RETENTION_DAYS = {
  events: 90, // eventos del pixel (navegación)
  visitors: 90, // visitantes sin actividad
  carts: 90, // carritos (con correo/teléfono cifrados)
  orders: 365, // pedidos, para medir ventas recuperadas
  webhookReceipts: 30,
  auditLogs: 730, // registro de auditoría y de accesos a datos personales
  uninstalledStores: 30, // respaldo si Shopify no envía shop/redact (llega a las 48 h)
} as const;

const DAY = 24 * 60 * 60 * 1000;
const before = (now: Date, days: number) => ({ lt: new Date(now.getTime() - days * DAY) });

/** Borra los datos que superaron su plazo de retención. Devuelve cuántos registros borró de cada tipo. */
export async function applyRetention(prisma: PrismaClient, now = new Date()) {
  const [events, visitors, carts, orders, webhookReceipts, auditLogs, oauthStates, sessions, stores] = await prisma.$transaction([
    prisma.event.deleteMany({ where: { occurredAt: before(now, RETENTION_DAYS.events) } }),
    prisma.visitor.deleteMany({ where: { lastSeen: before(now, RETENTION_DAYS.visitors) } }),
    prisma.cart.deleteMany({ where: { updatedAt: before(now, RETENTION_DAYS.carts) } }),
    prisma.order.deleteMany({ where: { orderedAt: before(now, RETENTION_DAYS.orders) } }),
    prisma.webhookReceipt.deleteMany({ where: { receivedAt: before(now, RETENTION_DAYS.webhookReceipts) } }),
    prisma.auditLog.deleteMany({ where: { createdAt: before(now, RETENTION_DAYS.auditLogs) } }),
    prisma.shopifyOAuthState.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.store.deleteMany({ where: { status: "UNINSTALLED", uninstalledAt: before(now, RETENTION_DAYS.uninstalledStores) } }),
  ]);
  return {
    events: events.count, visitors: visitors.count, carts: carts.count, orders: orders.count,
    webhookReceipts: webhookReceipts.count, auditLogs: auditLogs.count, oauthStates: oauthStates.count,
    sessions: sessions.count, stores: stores.count,
  };
}
