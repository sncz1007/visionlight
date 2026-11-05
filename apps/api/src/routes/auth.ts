import type { FastifyInstance, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";
import { loginSchema, signupSchema, slugify } from "@visionlight/shared";
import { config } from "../lib/config.js";
import { createSession, hashToken } from "../lib/session.js";
import { audit } from "../lib/audit.js";

// Hash ficticio para que un email inexistente tarde lo mismo que uno real.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 12);

function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date) {
  reply.setCookie(config.cookieName, token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function authRoutes(app: FastifyInstance) {
  const strictLimit = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

  app.post("/auth/signup", strictLimit, async (req, reply) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos", issues: parsed.error.issues });
    const { name, email, password, organizationName } = parsed.data;

    const existing = await app.prisma.user.findUnique({ where: { email } });
    if (existing) return reply.code(409).send({ error: "Ya existe una cuenta con ese email" });

    const passwordHash = await bcrypt.hash(password, 12);
    const baseSlug = slugify(organizationName);
    const slugTaken = await app.prisma.organization.findUnique({ where: { slug: baseSlug } });
    const slug = slugTaken ? `${baseSlug}-${Math.random().toString(36).slice(2, 7)}` : baseSlug;

    const { user, organization } = await app.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, name, passwordHash } });
      const organization = await tx.organization.create({
        data: { name: organizationName, slug, memberships: { create: { userId: user.id, role: "OWNER" } } },
      });
      return { user, organization };
    });

    const { token, expiresAt } = await createSession(app.prisma, user.id, { ip: req.ip, userAgent: req.headers["user-agent"] });
    setSessionCookie(reply, token, expiresAt);
    await audit(app.prisma, { action: "user.signup", userId: user.id, organizationId: organization.id, ip: req.ip });

    return reply.code(201).send({
      user: { id: user.id, email: user.email, name: user.name },
      organization: { id: organization.id, name: organization.name, slug: organization.slug },
    });
  });

  app.post("/auth/login", strictLimit, async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos" });
    const { email, password } = parsed.data;

    const user = await app.prisma.user.findUnique({ where: { email } });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      await audit(app.prisma, { action: "user.login_failed", userId: user?.id, ip: req.ip, metadata: { email } });
      return reply.code(401).send({ error: "Email o contraseña incorrectos" });
    }

    const { token, expiresAt } = await createSession(app.prisma, user.id, { ip: req.ip, userAgent: req.headers["user-agent"] });
    setSessionCookie(reply, token, expiresAt);
    await audit(app.prisma, { action: "user.login", userId: user.id, ip: req.ip });
    return { user: { id: user.id, email: user.email, name: user.name } };
  });

  app.post("/auth/logout", async (req, reply) => {
    const token = req.cookies[config.cookieName];
    if (token) await app.prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
    reply.clearCookie(config.cookieName, { path: "/" });
    return { ok: true };
  });

  app.get("/auth/me", { preHandler: app.requireUser }, async (req) => {
    const memberships = await app.prisma.membership.findMany({
      where: { userId: req.user!.id },
      include: { organization: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "asc" },
    });
    return {
      user: req.user,
      organizations: memberships.map((m) => ({ ...m.organization, role: m.role })),
    };
  });
}
