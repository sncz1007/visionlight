import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@visionlight/database";
import { config } from "../lib/config.js";
import { hashToken } from "../lib/session.js";

export type AuthUser = { id: string; email: string; name: string | null };

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
    sessionId: string | null;
    membership: { organizationId: string; role: Role } | null;
  }
  interface FastifyInstance {
    requireUser: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireOrgRole: (roles: Role[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const authPlugin = fp(async (app) => {
  app.decorateRequest("user", null);
  app.decorateRequest("sessionId", null);
  app.decorateRequest("membership", null);

  // Lee la cookie de sesión en cada petición.
  app.addHook("onRequest", async (req) => {
    const token = req.cookies[config.cookieName];
    if (!token) return;
    const session = await app.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    if (!session || session.expiresAt < new Date()) return;
    req.user = session.user;
    req.sessionId = session.id;
  });

  app.decorate("requireUser", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) return reply.code(401).send({ error: "No autenticado" });
  });

  // Verifica que el usuario pertenezca a la organización de la URL y tenga el rol pedido.
  // Toda ruta con :orgId debe pasar por aquí: así los datos de cada empresa quedan separados.
  app.decorate("requireOrgRole", (roles: Role[]) => async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) return reply.code(401).send({ error: "No autenticado" });
    const { orgId } = req.params as { orgId?: string };
    if (!orgId) return reply.code(400).send({ error: "Falta la organización" });
    const membership = await app.prisma.membership.findUnique({
      where: { userId_organizationId: { userId: req.user.id, organizationId: orgId } },
    });
    // 404 en vez de 403 para no revelar que la organización existe.
    if (!membership) return reply.code(404).send({ error: "Organización no encontrada" });
    if (!roles.includes(membership.role)) return reply.code(403).send({ error: "Permisos insuficientes" });
    req.membership = { organizationId: orgId, role: membership.role };
  });
});
