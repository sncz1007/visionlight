import type { FastifyInstance } from "fastify";
import { audit, logPersonalDataAccess } from "../lib/audit.js";
import { decryptOptional } from "../lib/crypto.js";

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

  // Carritos abiertos o abandonados, con los datos del cliente descifrados.
  // Cada consulta queda en el registro de accesos a datos personales.
  app.get("/orgs/:orgId/carts", anyMember, async (req) => {
    const orgId = req.membership!.organizationId;
    const carts = await app.prisma.cart.findMany({
      where: { store: { organizationId: orgId }, status: { in: ["OPEN", "ABANDONED"] } },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { store: { select: { shopDomain: true } } },
    });
    await logPersonalDataAccess(app.prisma, {
      organizationId: orgId, userId: req.user!.id, ip: req.ip, resource: "cart",
      recordIds: carts.filter((c) => c.emailEnc || c.phoneEnc || c.nameEnc).map((c) => c.id), purpose: "panel: lista de carritos",
    });
    return {
      carts: carts.map((c) => ({
        id: c.id,
        shop: c.store.shopDomain,
        status: c.status,
        email: decryptOptional(c.emailEnc),
        phone: decryptOptional(c.phoneEnc),
        name: decryptOptional(c.nameEnc),
        marketingConsent: c.marketingConsent,
        totalPrice: c.totalPrice.toString(),
        currency: c.currency,
        lineItems: c.lineItems,
        recoveryUrl: c.recoveryUrl,
        updatedAt: c.updatedAt,
      })),
    };
  });

  app.post("/orgs/:orgId/stores/:storeId/disconnect", admins, async (req, reply) => {
    const { storeId } = req.params as { storeId: string };
    const store = await app.prisma.store.findFirst({ where: { id: storeId, organizationId: req.membership!.organizationId } });
    if (!store) return reply.code(404).send({ error: "Tienda no encontrada" });
    await app.prisma.store.update({ where: { id: store.id }, data: { status: "UNINSTALLED", accessTokenEnc: null, refreshTokenEnc: null, uninstalledAt: new Date() } });
    await audit(app.prisma, { action: "store.disconnected", userId: req.user!.id, organizationId: store.organizationId, ip: req.ip, metadata: { shop: store.shopDomain } });
    return { ok: true };
  });
}
