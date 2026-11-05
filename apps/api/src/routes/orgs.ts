import type { FastifyInstance } from "fastify";
import { addMemberSchema } from "@visionlight/shared";
import { audit } from "../lib/audit.js";

export async function orgRoutes(app: FastifyInstance) {
  const anyMember = { preHandler: app.requireOrgRole(["OWNER", "ADMIN", "MEMBER"]) };
  const admins = { preHandler: app.requireOrgRole(["OWNER", "ADMIN"]) };

  app.get("/orgs/:orgId", anyMember, async (req) => {
    const org = await app.prisma.organization.findUniqueOrThrow({
      where: { id: req.membership!.organizationId },
      select: { id: true, name: true, slug: true, createdAt: true },
    });
    return { organization: org, role: req.membership!.role };
  });

  app.get("/orgs/:orgId/members", anyMember, async (req) => {
    const members = await app.prisma.membership.findMany({
      where: { organizationId: req.membership!.organizationId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return { members: members.map((m) => ({ id: m.id, role: m.role, user: m.user, createdAt: m.createdAt })) };
  });

  // Añade a un usuario que ya tiene cuenta. Las invitaciones por email llegan en la fase 3.
  app.post("/orgs/:orgId/members", admins, async (req, reply) => {
    const parsed = addMemberSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos" });
    const orgId = req.membership!.organizationId;
    const user = await app.prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user) return reply.code(404).send({ error: "No hay ningún usuario con ese email" });
    const existing = await app.prisma.membership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
    });
    if (existing) return reply.code(409).send({ error: "Ese usuario ya es miembro" });
    const membership = await app.prisma.membership.create({
      data: { userId: user.id, organizationId: orgId, role: parsed.data.role },
    });
    await audit(app.prisma, {
      action: "member.added", userId: req.user!.id, organizationId: orgId, ip: req.ip,
      metadata: { memberUserId: user.id, role: membership.role },
    });
    return reply.code(201).send({ id: membership.id, role: membership.role });
  });

  app.get("/orgs/:orgId/audit-logs", admins, async (req) => {
    const logs = await app.prisma.auditLog.findMany({
      where: { organizationId: req.membership!.organizationId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, action: true, userId: true, metadata: true, createdAt: true },
    });
    return { logs };
  });
}
