import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";

const SECRET = "test-shopify-secret";
process.env.SHOPIFY_API_KEY = "test-key";
process.env.SHOPIFY_API_SECRET = SECRET;
process.env.APP_URL = "https://api.visionlight.test";

const { prisma, applyRetention } = await import("@visionlight/database");
const { buildApp } = await import("../src/app.js");
const { decrypt, blindIndex } = await import("../src/lib/crypto.js");
const { normalizeShopDomain, verifyQueryHmac } = await import("../src/shopify/oauth.js");
const { adminForStore } = await import("../src/shopify/store-admin.js");

let app: FastifyInstance;
const SHOP = "visionlight-demo.myshopify.com";

function cookieFrom(res: { headers: Record<string, unknown> }) {
  const raw = res.headers["set-cookie"];
  return (Array.isArray(raw) ? raw[0] : String(raw)).split(";")[0]!;
}
function signQuery(params: Record<string, string>) {
  const msg = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  return { ...params, hmac: createHmac("sha256", SECRET).update(msg).digest("hex") };
}
function signBody(body: string) {
  return createHmac("sha256", SECRET).update(body).digest("base64");
}
async function signup(email: string, org: string) {
  const res = await app.inject({ method: "POST", url: "/auth/signup", payload: { name: "T", email, password: "una-clave-segura", organizationName: org, acceptTerms: true } });
  return { cookie: cookieFrom(res), orgId: res.json().organization.id as string };
}
async function webhook(topic: string, payload: object, id = Math.random().toString(36)) {
  const body = JSON.stringify(payload);
  return app.inject({
    method: "POST", url: "/webhooks/shopify", payload: body,
    headers: { "content-type": "application/json", "x-shopify-topic": topic, "x-shopify-shop-domain": SHOP, "x-shopify-webhook-id": id, "x-shopify-hmac-sha256": signBody(body) },
  });
}
async function connectStore(cookie: string, orgId: string) {
  const install = await app.inject({ method: "POST", url: `/orgs/${orgId}/shopify/install`, headers: { cookie }, payload: { shop: "visionlight-demo" } });
  const state = new URL(install.json().url).searchParams.get("state")!;
  const q = signQuery({ code: "abc", shop: SHOP, state, timestamp: "1700000000" });
  return app.inject({ method: "GET", url: `/shopify/callback?${new URLSearchParams(q)}` });
}

// Simula las respuestas de Shopify.
let pixelExists = false;
const tokenRequests: Record<string, string>[] = [];
const pixelUpdates: any[] = [];
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (url.endsWith("/admin/oauth/access_token")) {
    const form = new URLSearchParams(String(init?.body ?? ""));
    tokenRequests.push(Object.fromEntries(form));
    if (form.get("grant_type") === "refresh_token") {
      return Response.json({ access_token: "shpat_renovado", scope: "read_orders", expires_in: 3600, refresh_token: "shprt_nuevo", refresh_token_expires_in: 7776000 });
    }
    return Response.json({ access_token: "shpat_secreto", scope: "read_orders", expires_in: 3600, refresh_token: "shprt_inicial", refresh_token_expires_in: 7776000 });
  }
  const body = JSON.parse(String(init?.body ?? "{}"));
  if (body.query?.includes("shop {")) return Response.json({ data: { shop: { name: "Demo", currencyCode: "USD" } } });
  if (body.query?.includes("webhookSubscriptionCreate")) return Response.json({ data: { webhookSubscriptionCreate: { userErrors: [] } } });
  if (body.query?.includes("webPixelCreate")) {
    if (pixelExists) return Response.json({ data: { webPixelCreate: { webPixel: null, userErrors: [{ code: "TAKEN", message: "taken" }] } } });
    pixelExists = true;
    return Response.json({ data: { webPixelCreate: { webPixel: { id: "gid://shopify/WebPixel/1" }, userErrors: [] } } });
  }
  if (body.query?.includes("webPixelUpdate")) {
    if (!body.variables?.id) return Response.json({ errors: [{ message: "Variable $id of type ID! was not provided" }] });
    pixelUpdates.push(body.variables);
    return Response.json({ data: { webPixelUpdate: { webPixel: { id: body.variables.id }, userErrors: [] } } });
  }
  if (body.query?.includes("webPixel {")) return Response.json({ data: { webPixel: pixelExists ? { id: "gid://shopify/WebPixel/1" } : null } });
  return new Response("not found", { status: 404 });
});

beforeAll(async () => { vi.stubGlobal("fetch", fetchMock); app = await buildApp({ logger: false }); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); vi.unstubAllGlobals(); });
beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "Event","Visitor","Cart","Order","Store","ShopifyOAuthState","WebhookReceipt","AuditLog","Session","Membership","User","Organization" CASCADE');
});
afterEach(() => { fetchMock.mockClear(); pixelExists = false; pixelUpdates.length = 0; tokenRequests.length = 0; });

describe("utilidades OAuth", () => {
  it("normaliza dominios y rechaza los que no son de Shopify", () => {
    expect(normalizeShopDomain("Mi-Tienda")).toBe("mi-tienda.myshopify.com");
    expect(normalizeShopDomain("https://mi-tienda.myshopify.com/admin")).toBe("mi-tienda.myshopify.com");
    expect(normalizeShopDomain("evil.com")).toBeNull();
    expect(normalizeShopDomain("x.myshopify.com.evil.com")).toBeNull();
  });
  it("verifica la firma de la URL", () => {
    const q = signQuery({ shop: SHOP, code: "1", state: "s", timestamp: "1" });
    expect(verifyQueryHmac(q)).toBe(true);
    expect(verifyQueryHmac({ ...q, code: "2" })).toBe(false);
  });
});

describe("conexión de tienda", () => {
  it("instala, cifra el token, registra webhooks y pixel", async () => {
    const { cookie, orgId } = await signup("a@a.com", "Empresa A");
    const res = await connectStore(cookie, orgId);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("shopify=connected");
    const store = await prisma.store.findUniqueOrThrow({ where: { shopDomain: SHOP } });
    expect(store.accessTokenEnc).not.toContain("shpat_secreto");
    expect(decrypt(store.accessTokenEnc!)).toBe("shpat_secreto");
    expect(store.webPixelId).toBe("gid://shopify/WebPixel/1");
    // Pide tokens que vencen y guarda el refresh token cifrado.
    expect(tokenRequests[0]).toMatchObject({ code: "abc", expiring: "1" });
    expect(store.accessTokenExpiresAt!.getTime()).toBeGreaterThan(Date.now());
    expect(store.refreshTokenEnc).not.toContain("shprt_inicial");
    expect(decrypt(store.refreshTokenEnc!)).toBe("shprt_inicial");
    const list = await app.inject({ method: "GET", url: `/orgs/${orgId}/stores`, headers: { cookie } });
    expect(list.json().stores[0]).toMatchObject({ shopDomain: SHOP, pixelActive: true });
    expect(JSON.stringify(list.json())).not.toContain("accessToken");
  });

  it("al reconectar actualiza el pixel existente y conserva su clave", async () => {
    const { cookie, orgId } = await signup("a@a.com", "Empresa A");
    await connectStore(cookie, orgId);
    const before = await prisma.store.findUniqueOrThrow({ where: { shopDomain: SHOP } });
    await connectStore(cookie, orgId);
    const after = await prisma.store.findUniqueOrThrow({ where: { shopDomain: SHOP } });
    expect(after.pixelKey).toBe(before.pixelKey);
    expect(after.webPixelId).toBe("gid://shopify/WebPixel/1");
    expect(pixelUpdates).toHaveLength(1);
    expect(JSON.parse(pixelUpdates[0].webPixel.settings === undefined ? "{}" : JSON.stringify(pixelUpdates[0].webPixel.settings))).toMatchObject({
      accountID: before.pixelKey, ingestUrl: "https://api.visionlight.test/ingest/pixel",
    });
  });

  it("renueva el token cuando está por vencer", async () => {
    const { cookie, orgId } = await signup("a@a.com", "Empresa A");
    await connectStore(cookie, orgId);
    let store = await prisma.store.findUniqueOrThrow({ where: { shopDomain: SHOP } });
    await adminForStore(prisma, store);
    expect(tokenRequests).toHaveLength(1); // vigente: no renueva
    store = await prisma.store.update({ where: { id: store.id }, data: { accessTokenExpiresAt: new Date(Date.now() + 60_000) } });
    await adminForStore(prisma, store);
    expect(tokenRequests[1]).toMatchObject({ grant_type: "refresh_token", refresh_token: "shprt_inicial" });
    store = await prisma.store.findUniqueOrThrow({ where: { id: store.id } });
    expect(decrypt(store.accessTokenEnc!)).toBe("shpat_renovado");
    expect(decrypt(store.refreshTokenEnc!)).toBe("shprt_nuevo");
  });

  it("rechaza un callback con firma falsa", async () => {
    const res = await app.inject({ method: "GET", url: `/shopify/callback?shop=${SHOP}&code=x&state=y&timestamp=1&hmac=deadbeef` });
    expect(res.statusCode).toBe(400);
  });

  it("rechaza un state reutilizado", async () => {
    const { cookie, orgId } = await signup("a@a.com", "Empresa A");
    const install = await app.inject({ method: "POST", url: `/orgs/${orgId}/shopify/install`, headers: { cookie }, payload: { shop: SHOP } });
    const state = new URL(install.json().url).searchParams.get("state")!;
    const url = `/shopify/callback?${new URLSearchParams(signQuery({ code: "abc", shop: SHOP, state, timestamp: "1" }))}`;
    expect((await app.inject({ method: "GET", url })).headers.location).toContain("connected");
    expect((await app.inject({ method: "GET", url })).headers.location).toContain("error");
  });

  it("otra empresa no puede ver ni robar la tienda", async () => {
    const a = await signup("a@a.com", "Empresa A");
    const b = await signup("b@b.com", "Empresa B");
    await connectStore(a.cookie, a.orgId);
    const list = await app.inject({ method: "GET", url: `/orgs/${b.orgId}/stores`, headers: { cookie: b.cookie } });
    expect(list.json().stores).toHaveLength(0);
    const steal = await app.inject({ method: "POST", url: `/orgs/${b.orgId}/shopify/install`, headers: { cookie: b.cookie }, payload: { shop: SHOP } });
    expect(steal.statusCode).toBe(409);
  });
});

describe("webhooks", () => {
  it("rechaza firmas no válidas", async () => {
    const res = await app.inject({ method: "POST", url: "/webhooks/shopify", payload: "{}", headers: { "content-type": "application/json", "x-shopify-hmac-sha256": "bad", "x-shopify-topic": "orders/create", "x-shopify-shop-domain": SHOP } });
    expect(res.statusCode).toBe(401);
  });

  it("guarda el carrito y lo cierra cuando llega el pedido", async () => {
    const { cookie, orgId } = await signup("a@a.com", "Empresa A");
    await connectStore(cookie, orgId);
    const checkout = { token: "tok1", email: "Cliente@X.com", shipping_address: { first_name: "Ana", last_name: "Pérez", phone: "+573001112233" }, total_price: "49.90", currency: "USD", buyer_accepts_marketing: true, line_items: [{ product_id: 1, variant_id: 2, title: "Camiseta", quantity: 1, price: "49.90" }], abandoned_checkout_url: "https://x/recover" };
    expect((await webhook("checkouts/create", checkout)).statusCode).toBe(200);
    let cart = await prisma.cart.findFirstOrThrow();
    expect(cart).toMatchObject({ status: "OPEN", marketingConsent: true });
    // Correo y teléfono se guardan cifrados, nunca en texto plano.
    expect(cart.emailEnc).not.toContain("cliente");
    expect(decrypt(cart.emailEnc!)).toBe("cliente@x.com");
    expect(cart.phoneEnc).not.toContain("3001112233");
    expect(decrypt(cart.phoneEnc!)).toBe("+573001112233");
    expect(cart.emailHash).toBe(blindIndex("cliente@x.com"));
    expect(cart.totalPrice.toString()).toBe("49.9");

    // El panel muestra el carrito con los datos descifrados y registra el acceso.
    const list = await app.inject({ method: "GET", url: `/orgs/${orgId}/carts`, headers: { cookie } });
    expect(list.json().carts[0]).toMatchObject({ email: "cliente@x.com", phone: "+573001112233", name: "Ana Pérez", marketingConsent: true, totalPrice: "49.9" });
    expect(await prisma.auditLog.count({ where: { action: "personal_data.accessed" } })).toBe(1);

    await webhook("orders/create", { id: 99, checkout_token: "tok1", email: "cliente@x.com", total_price: "49.90", currency: "USD", created_at: new Date().toISOString() });
    cart = await prisma.cart.findFirstOrThrow();
    expect(cart.status).toBe("COMPLETED");
    // Un aviso de checkout atrasado no reabre el carrito.
    await webhook("checkouts/update", checkout);
    expect((await prisma.cart.findFirstOrThrow()).status).toBe("COMPLETED");
    expect(await prisma.order.count()).toBe(1);
  });

  it("no procesa dos veces el mismo webhook", async () => {
    const { cookie, orgId } = await signup("a@a.com", "Empresa A");
    await connectStore(cookie, orgId);
    const r1 = await webhook("orders/create", { id: 1, total_price: "10", currency: "USD" }, "same-id");
    const r2 = await webhook("orders/create", { id: 1, total_price: "10", currency: "USD" }, "same-id");
    expect(r1.json().duplicate).toBeUndefined();
    expect(r2.json().duplicate).toBe(true);
  });

  it("app/uninstalled borra el token y customers/redact borra datos del cliente", async () => {
    const { cookie, orgId } = await signup("a@a.com", "Empresa A");
    await connectStore(cookie, orgId);
    await webhook("checkouts/create", { token: "t", email: "borrar@x.com", total_price: "5", currency: "USD", line_items: [] });
    await webhook("customers/redact", { customer: { email: "BORRAR@x.com" } });
    expect(await prisma.cart.count()).toBe(0);
    await webhook("app/uninstalled", {});
    const store = await prisma.store.findUniqueOrThrow({ where: { shopDomain: SHOP } });
    expect(store).toMatchObject({ status: "UNINSTALLED", accessTokenEnc: null });
    await webhook("shop/redact", {});
    expect(await prisma.store.count()).toBe(0);
  });
});

describe("Retención de datos", () => {
  it("borra lo que superó su plazo y conserva lo reciente", async () => {
    const { cookie, orgId } = await signup("a@a.com", "Empresa A");
    await connectStore(cookie, orgId);
    await webhook("checkouts/create", { token: "nuevo", total_price: "5", currency: "USD", line_items: [] });
    await webhook("checkouts/create", { token: "viejo", total_price: "5", currency: "USD", line_items: [] });
    const old = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    await prisma.$executeRaw`UPDATE "Cart" SET "updatedAt" = ${old} WHERE "checkoutToken" = 'viejo'`;
    const result = await applyRetention(prisma);
    expect(result.carts).toBe(1);
    expect((await prisma.cart.findMany()).map((c) => c.checkoutToken)).toEqual(["nuevo"]);
  });
});

describe("Web Pixel", () => {
  it("acepta eventos con clave válida, ignora duplicados y eventos no rastreados", async () => {
    const { cookie, orgId } = await signup("a@a.com", "Empresa A");
    await connectStore(cookie, orgId);
    const { pixelKey } = await prisma.store.findUniqueOrThrow({ where: { shopDomain: SHOP } });
    const ev = (id: string, name: string) => ({ id, name, clientId: "client-1", timestamp: new Date().toISOString(), url: "https://demo/p/1", data: { productVariant: { id: "1" } } });
    const body = JSON.stringify({ key: pixelKey, events: [ev("e1", "product_viewed"), ev("e2", "product_added_to_cart"), ev("e3", "ui_extension_errored")] });
    const res = await app.inject({ method: "POST", url: "/ingest/pixel", payload: body, headers: { "content-type": "text/plain" } });
    expect(res.statusCode).toBe(202);
    await app.inject({ method: "POST", url: "/ingest/pixel", payload: body, headers: { "content-type": "text/plain" } });
    expect(await prisma.event.count()).toBe(2);
    expect(await prisma.visitor.count()).toBe(1);

    const activity = await app.inject({ method: "GET", url: `/orgs/${orgId}/activity`, headers: { cookie } });
    expect(activity.json().last7Days).toMatchObject({ visitors: 1, productViews: 1, addToCarts: 1 });
  });

  it("rechaza claves desconocidas", async () => {
    const res = await app.inject({ method: "POST", url: "/ingest/pixel", payload: { key: "clave-que-no-existe", events: [{ id: "1", name: "page_viewed", clientId: "c", timestamp: "x" }] } });
    expect(res.statusCode).toBe(404);
  });
});
