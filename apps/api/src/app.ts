import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { prisma as defaultPrisma, type PrismaClient } from "@visionlight/database";
import { config } from "./lib/config.js";
import { authPlugin } from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { orgRoutes } from "./routes/orgs.js";
import { shopifyRoutes } from "./routes/shopify.js";
import { ingestRoutes } from "./routes/ingest.js";
import { storeRoutes } from "./routes/stores.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export async function buildApp(opts: { prisma?: PrismaClient; logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? true, trustProxy: true });
  app.decorate("prisma", opts.prisma ?? defaultPrisma);

  await app.register(helmet);
  // El Web Pixel envía eventos desde cualquier tienda (sin cookies); el resto solo acepta al panel.
  await app.register(cors, () => (req: { url?: string }, cb: (err: Error | null, opts: object) => void) =>
    cb(null, req.url?.startsWith("/ingest/")
      ? { origin: true, credentials: false, methods: ["POST"] }
      : { origin: config.dashboardUrl, credentials: true }));
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  await app.register(cookie);
  await app.register(authPlugin);

  app.get("/health", async () => ({ ok: true }));
  await app.register(authRoutes);
  await app.register(orgRoutes);
  await app.register(storeRoutes);
  await app.register(shopifyRoutes);
  await app.register(ingestRoutes);

  return app;
}
