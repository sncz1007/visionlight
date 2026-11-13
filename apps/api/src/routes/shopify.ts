import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { config, shopifyConfigured } from "../lib/config.js";
import { encrypt } from "../lib/crypto.js";
import { audit } from "../lib/audit.js";
import {
  buildAuthorizeUrl, exchangeCodeForToken, isValidShopDomain, normalizeShopDomain, verifyQueryHmac, verifyWebhookHmac,
} from "../shopify/oauth.js";
import { ShopifyAdmin, createWebPixel, registerWebhooks } from "../shopify/admin.js";
import {
  handleAppUninstalled, handleCheckout, handleCustomerRedact, handleOrderCreate, handleShopRedact,
} from "../shopify/webhooks.js";

const STATE_TTL_MS = 10 * 60 * 1000;

export async function shopifyRoutes(app: FastifyInstance) {
  // 1) El panel pide la URL de autorización para conectar una tienda.
  app.post("/orgs/:orgId/shopify/install", { preHandler: app.requireOrgRole(["OWNER", "ADMIN"]) }, async (req, reply) => {
    if (!shopifyConfigured()) return reply.code(503).send({ error: "Shopify no está configurado en el servidor" });
    const body = z.object({ shop: z.string().min(1).max(255) }).safeParse(req.body);
    const shop = body.success ? normalizeShopDomain(body.data.shop) : null;
    if (!shop) return reply.code(400).send({ error: "Dirección de tienda no válida (ej.: mitienda.myshopify.com)" });

    const existing = await app.prisma.store.findUnique({ where: { shopDomain: shop } });
    if (existing && existing.organizationId !== req.membership!.organizationId && existing.status === "ACTIVE") {
      return reply.code(409).send({ error: "Esa tienda ya está conectada a otra cuenta" });
    }

    const nonce = randomBytes(24).toString("base64url");
    await app.prisma.shopifyOAuthState.create({
      data: {
        nonce, shopDomain: shop, organizationId: req.membership!.organizationId, userId: req.user!.id,
        expiresAt: new Date(Date.now() + STATE_TTL_MS),
      },
    });
    return { url: buildAuthorizeUrl(shop, nonce) };
  });

  // 2) Shopify redirige aquí tras aprobar la instalación.
  app.get("/shopify/callback", async (req, reply) => {
    const q = req.query as Record<string, string>;
    const fail = (reason: string) => reply.redirect(`${config.dashboardUrl}/dashboard?shopify=error&reason=${encodeURIComponent(reason)}`);

    if (!verifyQueryHmac(q)) return reply.code(400).send({ error: "Firma de Shopify no válida" });
    if (!isValidShopDomain(q.shop) || !q.code || !q.state) return reply.code(400).send({ error: "Parámetros incompletos" });

    // El state solo se puede usar una vez, debe estar vigente y ser de esta tienda.
    const state = await app.prisma.shopifyOAuthState.findUnique({ where: { nonce: q.state } });
    if (state) await app.prisma.shopifyOAuthState.delete({ where: { id: state.id } });
    if (!state || state.expiresAt < new Date() || state.shopDomain !== q.shop) return fail("state");

    let accessToken: string, scope: string;
    try {
      ({ accessToken, scope } = await exchangeCodeForToken(q.shop, q.code));
    } catch (err) {
      req.log.error(err, "Fallo al intercambiar el código OAuth");
      return fail("token");
    }

    const admin = new ShopifyAdmin(q.shop, accessToken);
    const info = await admin.getShopInfo().catch(() => null);
    const prior = await app.prisma.store.findUnique({ where: { shopDomain: q.shop } });
    if (prior && prior.organizationId !== state.organizationId && prior.status === "ACTIVE") return fail("taken");

    // Se conserva la clave del pixel al reconectar: así el pixel ya instalado sigue funcionando
    // aunque falle su actualización.
    const pixelKey = prior?.pixelKey ?? randomBytes(18).toString("base64url");
    const store = await app.prisma.store.upsert({
      where: { shopDomain: q.shop },
      create: {
        organizationId: state.organizationId, shopDomain: q.shop, name: info?.name, currency: info?.currencyCode,
        accessTokenEnc: encrypt(accessToken), scopes: scope, pixelKey,
      },
      update: {
        organizationId: state.organizationId, name: info?.name, currency: info?.currencyCode,
        accessTokenEnc: encrypt(accessToken), scopes: scope, status: "ACTIVE", uninstalledAt: null, pixelKey,
        installedAt: new Date(),
      },
    });

    // Webhooks y pixel: si fallan, la tienda queda conectada y se puede reintentar.
    try {
      const errors = await registerWebhooks(admin);
      if (errors.length) req.log.warn({ errors }, "Algunos webhooks no se registraron");
      const webPixelId = await createWebPixel(admin, pixelKey);
      if (webPixelId) await app.prisma.store.update({ where: { id: store.id }, data: { webPixelId } });
    } catch (err) {
      req.log.error(err, "Fallo configurando webhooks o Web Pixel");
    }

    await audit(app.prisma, {
      action: "store.connected", userId: state.userId, organizationId: state.organizationId, ip: req.ip,
      metadata: { shop: q.shop },
    });
    return reply.redirect(`${config.dashboardUrl}/dashboard?shopify=connected`);
  });

  // 3) Webhooks: necesitan el cuerpo original (sin procesar) para verificar la firma.
  await app.register(async (scope) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser("*", { parseAs: "buffer", bodyLimit: 2 * 1024 * 1024 }, (_req, body, done) => done(null, body));

    scope.post("/webhooks/shopify", { config: { rateLimit: false } }, async (req, reply) => {
      const raw = req.body as Buffer;
      const h = req.headers;
      if (!verifyWebhookHmac(raw, h["x-shopify-hmac-sha256"] as string | undefined)) {
        return reply.code(401).send({ error: "Firma no válida" });
      }
      const topic = String(h["x-shopify-topic"] ?? "");
      const shop = String(h["x-shopify-shop-domain"] ?? "");
      const webhookId = String(h["x-shopify-webhook-id"] ?? h["x-shopify-event-id"] ?? "");

      // Shopify puede reenviar el mismo aviso: lo procesamos una sola vez.
      if (webhookId) {
        const seen = await app.prisma.webhookReceipt.findUnique({ where: { webhookId } });
        if (seen) return reply.code(200).send({ ok: true, duplicate: true });
      }

      let payload: Record<string, any>;
      try {
        payload = JSON.parse(raw.toString("utf8"));
      } catch {
        return reply.code(400).send({ error: "JSON no válido" });
      }

      const store = await app.prisma.store.findUnique({ where: { shopDomain: shop } });
      if (store) {
        switch (topic) {
          case "checkouts/create":
          case "checkouts/update":
            if (store.status === "ACTIVE") await handleCheckout(app.prisma, store.id, payload);
            break;
          case "orders/create":
            if (store.status === "ACTIVE") await handleOrderCreate(app.prisma, store.id, payload);
            break;
          case "app/uninstalled":
            await handleAppUninstalled(app.prisma, store.id);
            await audit(app.prisma, { action: "store.uninstalled", organizationId: store.organizationId, metadata: { shop } });
            break;
          case "customers/redact":
            await handleCustomerRedact(app.prisma, store.id, payload);
            break;
          case "shop/redact":
            await handleShopRedact(app.prisma, store.id);
            break;
          case "customers/data_request":
            // Se atiende manualmente: queda en la auditoría para responder a la tienda.
            await audit(app.prisma, {
              action: "privacy.data_request", organizationId: store.organizationId,
              metadata: { shop, customerId: payload.customer?.id ?? null, ordersRequested: payload.orders_requested ?? [] },
            });
            break;
          default:
            req.log.info({ topic }, "Webhook sin manejador");
        }
      }
      if (webhookId) await app.prisma.webhookReceipt.create({ data: { webhookId, topic, shopDomain: shop } }).catch(() => {});
      return reply.code(200).send({ ok: true });
    });
  });
}
