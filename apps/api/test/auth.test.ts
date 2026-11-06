import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { prisma } from "@visionlight/database";
import { buildApp } from "../src/app.js";

let app: FastifyInstance;

function cookieFrom(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers["set-cookie"];
  const first = Array.isArray(raw) ? raw[0] : String(raw);
  return first.split(";")[0]!;
}

async function signup(email: string, org: string) {
  const res = await app.inject({
    method: "POST", url: "/auth/signup",
    payload: { name: "Test", email, password: "una-clave-segura", organizationName: org },
  });
  return { res, cookie: cookieFrom(res), body: res.json() };
}

beforeAll(async () => { app = await buildApp({ logger: false }); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); });
beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "Event","Visitor","Cart","Order","Store","ShopifyOAuthState","WebhookReceipt","AuditLog","Session","Membership","User","Organization" CASCADE');
});

describe("auth", () => {
  it("signup crea usuario, empresa y sesión", async () => {
    const { res, cookie } = await signup("ana@tienda.com", "Tienda Ana");
    expect(res.statusCode).toBe(201);
    const me = await app.inject({ method: "GET", url: "/auth/me", headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().organizations[0]).toMatchObject({ name: "Tienda Ana", role: "OWNER" });
  });

  it("rechaza email duplicado", async () => {
    await signup("ana@tienda.com", "Tienda A");
    const { res } = await signup("ana@tienda.com", "Tienda B");
    expect(res.statusCode).toBe(409);
  });

  it("login con clave incorrecta da 401 y con la correcta da 200", async () => {
    await signup("ana@tienda.com", "Tienda A");
    const bad = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "ana@tienda.com", password: "mala" } });
    expect(bad.statusCode).toBe(401);
    const good = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "ANA@tienda.com", password: "una-clave-segura" } });
    expect(good.statusCode).toBe(200);
  });

  it("logout invalida la sesión", async () => {
    const { cookie } = await signup("ana@tienda.com", "Tienda A");
    await app.inject({ method: "POST", url: "/auth/logout", headers: { cookie } });
    const me = await app.inject({ method: "GET", url: "/auth/me", headers: { cookie } });
    expect(me.statusCode).toBe(401);
  });
});

describe("separación entre empresas", () => {
  it("un usuario no puede ver otra empresa", async () => {
    const a = await signup("a@a.com", "Empresa A");
    const b = await signup("b@b.com", "Empresa B");
    const res = await app.inject({ method: "GET", url: `/orgs/${b.body.organization.id}/members`, headers: { cookie: a.cookie } });
    expect(res.statusCode).toBe(404);
  });

  it("un MEMBER no puede añadir miembros ni ver auditoría", async () => {
    const owner = await signup("owner@a.com", "Empresa A");
    const other = await signup("m@a.com", "Otra");
    const orgId = owner.body.organization.id;
    const add = await app.inject({ method: "POST", url: `/orgs/${orgId}/members`, headers: { cookie: owner.cookie }, payload: { email: "m@a.com" } });
    expect(add.statusCode).toBe(201);
    const tryAdd = await app.inject({ method: "POST", url: `/orgs/${orgId}/members`, headers: { cookie: other.cookie }, payload: { email: "owner@a.com" } });
    expect(tryAdd.statusCode).toBe(403);
    const logs = await app.inject({ method: "GET", url: `/orgs/${orgId}/audit-logs`, headers: { cookie: other.cookie } });
    expect(logs.statusCode).toBe(403);
    const members = await app.inject({ method: "GET", url: `/orgs/${orgId}/members`, headers: { cookie: other.cookie } });
    expect(members.json().members).toHaveLength(2);
  });
});
