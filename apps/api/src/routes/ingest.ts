import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma } from "@visionlight/database";

// Eventos que guardamos. El resto se ignora para no acumular datos innecesarios.
export const TRACKED_EVENTS = new Set([
  "page_viewed", "product_viewed", "collection_viewed", "search_submitted",
  "product_added_to_cart", "product_removed_from_cart", "cart_viewed",
  "checkout_started", "checkout_contact_info_submitted", "checkout_completed",
]);

const eventSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(60),
  clientId: z.string().min(1).max(100),
  timestamp: z.string().max(40),
  url: z.string().max(2000).optional(),
  data: z.record(z.unknown()).optional(),
});
const batchSchema = z.object({ key: z.string().min(10).max(64), events: z.array(eventSchema).min(1).max(20) });

const MAX_DATA_BYTES = 8 * 1024;

export async function ingestRoutes(app: FastifyInstance) {
  await app.register(async (scope) => {
    // sendBeacon envía text/plain: lo interpretamos como JSON.
    scope.addContentTypeParser("text/plain", { parseAs: "string", bodyLimit: 128 * 1024 }, (_req, body, done) => {
      try { done(null, JSON.parse(body as string)); } catch { done(Object.assign(new Error("JSON no válido"), { statusCode: 400 }), undefined); }
    });

    scope.post("/ingest/pixel", { config: { rateLimit: { max: 600, timeWindow: "1 minute" } } }, async (req, reply) => {
      const parsed = batchSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos" });

      const store = await app.prisma.store.findUnique({ where: { pixelKey: parsed.data.key }, select: { id: true, status: true } });
      if (!store || store.status !== "ACTIVE") return reply.code(404).send({ error: "Tienda no encontrada" });

      const events = parsed.data.events.filter((e) => TRACKED_EVENTS.has(e.name));
      for (const e of events) {
        const occurredAt = new Date(e.timestamp);
        const when = Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt;
        const visitor = await app.prisma.visitor.upsert({
          where: { storeId_clientId: { storeId: store.id, clientId: e.clientId } },
          create: { storeId: store.id, clientId: e.clientId, firstSeen: when, lastSeen: when },
          update: { lastSeen: when },
        });
        let data = e.data as Prisma.InputJsonValue | undefined;
        if (data && JSON.stringify(data).length > MAX_DATA_BYTES) data = { truncated: true };
        await app.prisma.event.upsert({
          where: { storeId_externalId: { storeId: store.id, externalId: e.id } },
          create: { storeId: store.id, visitorId: visitor.id, externalId: e.id, name: e.name, url: e.url, data, occurredAt: when },
          update: {},
        });
      }
      return reply.code(202).send({ accepted: events.length });
    });
  });
}
