import type { FastifyInstance } from "fastify";
import { audit } from "../lib/audit.js";

export async function storeRoutes(app: FastifyInstance) {
  const anyMember = { preHandler: app.requireOrgRole(["OWNER", "ADMIN", "MEMBER"]) };
  const admins = { preHandler: app.requireOrgRole(["OWNER", "ADMIN"]) };

  app.get("/orgs/:orgId/stores", anyMember, async (req) => {
    const stores = await app.prisma.store.findMany({
      where: { organizationId: req.membership!.organizationId },
      select: { id: true, shopDomain: true, name: true, status: true, currency: true, installedAt: true, webPixelId: true },
      orderBy: { installedAt: "desc" },
    });
    return { stores: stores.map(({ webPixelId, ...s }) => ({ ...s, pixelActive: Boolean(webPixelId) })) };
  });

  // Resumen de actividad de los últimos 7 días para el panel.
  app.get("/orgs/:orgId/activity", anyMember, async (req) => {
    const orgId = req.membership!.organizationId;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const storeFilter = { store: { organizationId: orgId } };
    const [visitors, productViews, addToCarts, openCarts, orders, revenue, recent] = await Promise.all([
      app.prisma.visitor.count({ where: { ...storeFilter, lastSeen: { gte: since } } }),
      app.prisma.event.count({ where: { ...storeFilter, name: "product_viewed", occurredAt: { gte: since } } }),
      app.prisma.event.count({ where: { ...storeFilter, name: "product_added_to_cart", occurredAt: { gte: since } } }),
      app.prisma.cart.count({ where: { ...storeFilter, status: { in: ["OPEN", "ABANDONED"] } } }),
      app.prisma.order.count({ where: { ...storeFilter, orderedAt: { gte: since } } }),
      app.prisma.order.aggregate({ where: { ...storeFilter, orderedAt: { gte: since } }, _sum: { totalPrice: true } }),
      app.prisma.event.findMany({
        where: storeFilter,
        orderBy: { occurredAt: "desc" },
        take: 20,
        select: { id: true, name: true, url: true, occurredAt: true, store: { select: { shopDomain: true } } },
      }),
    ]);
    return {
      last7Days: { visitors, productViews, addToCarts, orders, revenue: revenue._sum.totalPrice?.toString() ?? "0" },
      openCarts,
      recentEvents: recent.map((e) => ({ id: e.id, name: e.name, url: e.url, occurredAt: e.occurredAt, shop: e.store.shopDomain })),
    };
  });

  app.post("/orgs/:orgId/stores/:storeId/disconnect", admins, async (req, reply) => {
    const { storeId } = req.params as { storeId: string };
    const store = await app.prisma.store.findFirst({ where: { id: storeId, organizationId: req.membership!.organizationId } });
    if (!store) return reply.code(404).send({ error: "Tienda no encontrada" });
    await app.prisma.store.update({ where: { id: store.id }, data: { status: "UNINSTALLED", accessTokenEnc: null, uninstalledAt: new Date() } });
    await audit(app.prisma, { action: "store.disconnected", userId: req.user!.id, organizationId: store.organizationId, ip: req.ip, metadata: { shop: store.shopDomain } });
    return { ok: true };
  });
}
