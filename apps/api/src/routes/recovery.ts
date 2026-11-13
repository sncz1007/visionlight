import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseUnsubscribeToken } from "@visionlight/database";
import { sign } from "../lib/crypto.js";
import { audit } from "../lib/audit.js";

export const DELAY_OPTIONS = [30, 60, 180, 1440] as const;
const settingsSchema = z.object({
  enabled: z.boolean(),
  delayMinutes: z.number().int().refine((n) => (DELAY_OPTIONS as readonly number[]).includes(n), "Tiempo no permitido"),
});

const page = (title: string, body: string) => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f6f7f9;color:#1f2937;margin:0">
<main style="max-width:420px;margin:64px auto;background:#fff;border-radius:12px;padding:28px;text-align:center">${body}</main></body></html>`;

export async function recoveryRoutes(app: FastifyInstance) {
  const admins = { preHandler: app.requireOrgRole(["OWNER", "ADMIN"]) };

  // Ajustes de recuperación de una tienda.
  app.patch("/orgs/:orgId/stores/:storeId/recovery", admins, async (req, reply) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos" });
    const { storeId } = req.params as { storeId: string };
    const store = await app.prisma.store.findFirst({ where: { id: storeId, organizationId: req.membership!.organizationId } });
    if (!store) return reply.code(404).send({ error: "Tienda no encontrada" });
    await app.prisma.store.update({
      where: { id: store.id },
      data: { recoveryEnabled: parsed.data.enabled, recoveryDelayMinutes: parsed.data.delayMinutes },
    });
    await audit(app.prisma, { action: "recovery.settings_updated", userId: req.user!.id, organizationId: store.organizationId, ip: req.ip, metadata: parsed.data });
    return { ok: true };
  });

  // Baja de los correos de recuperación. GET muestra un botón (para que los antivirus que abren
  // enlaces no den de baja a nadie); POST da de baja, y también lo usa Gmail con "un clic".
  await app.register(async (scope) => {
    scope.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_req, body, done) => done(null, body));

    scope.get("/u/:token", async (req, reply) => {
      const { token } = req.params as { token: string };
      if (!parseUnsubscribeToken(token, sign)) return reply.code(400).type("text/html").send(page("Enlace no válido", "<h1>Enlace no válido</h1>"));
      return reply.type("text/html").send(page("Darse de baja", `<h1 style="font-size:20px">¿Dejar de recibir estos correos?</h1>
<p style="color:#6b7280">No te volveremos a escribir sobre carritos de esta tienda.</p>
<form method="post"><button style="background:#4f46e5;color:#fff;border:0;border-radius:8px;padding:12px 20px;font-size:15px;cursor:pointer">Darme de baja</button></form>`));
    });

    scope.post("/u/:token", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
      const { token } = req.params as { token: string };
      const parsed = parseUnsubscribeToken(token, sign);
      if (!parsed) return reply.code(400).type("text/html").send(page("Enlace no válido", "<h1>Enlace no válido</h1>"));
      const store = await app.prisma.store.findUnique({ where: { id: parsed.storeId } });
      if (store) {
        await app.prisma.unsubscribe.upsert({
          where: { storeId_emailHash: { storeId: store.id, emailHash: parsed.emailHash } },
          create: { storeId: store.id, emailHash: parsed.emailHash },
          update: {},
        });
      }
      return reply.type("text/html").send(page("Listo", `<h1 style="font-size:20px">Listo ✅</h1><p style="color:#6b7280">Ya no recibirás más correos de recuperación de esta tienda.</p>`));
    });
  });
}
