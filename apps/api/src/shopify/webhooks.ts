import type { PrismaClient, Prisma } from "@visionlight/database";
import { blindIndex, encryptOptional, normalizeEmail, protectEmail } from "../lib/crypto.js";

type Json = Record<string, any>;

function money(v: unknown): string {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

// Solo guardamos lo necesario de cada producto del carrito (minimización de datos).
function slimLineItems(items: unknown): Prisma.InputJsonValue {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 100).map((i: Json) => ({
    productId: i.product_id ?? null,
    variantId: i.variant_id ?? null,
    title: String(i.title ?? i.presentment_title ?? "").slice(0, 200),
    quantity: Number(i.quantity ?? 1),
    price: money(i.price ?? i.line_price),
  }));
}

// El teléfono y el nombre pueden venir en el cliente o en las direcciones del pago.
function contactOf(p: Json) {
  const addr = [p.shipping_address, p.billing_address, p.customer?.default_address].filter(Boolean) as Json[];
  const phone = p.phone || p.customer?.phone || addr.find((a) => a.phone)?.phone || null;
  const named = [p.customer, ...addr].find((x) => x?.first_name || x?.last_name);
  const name = named ? [named.first_name, named.last_name].filter(Boolean).join(" ").trim() || null : null;
  return { phone: phone ? String(phone).slice(0, 40) : null, name: name ? name.slice(0, 120) : null };
}

export async function handleCheckout(prisma: PrismaClient, storeId: string, p: Json) {
  const token = p.token ?? p.cart_token;
  if (!token) return;
  const completed = Boolean(p.completed_at);
  const data = {
    ...protectEmail(p.email ?? p.customer?.email),
    phoneEnc: encryptOptional(contactOf(p).phone),
    nameEnc: encryptOptional(contactOf(p).name),
    customerId: p.customer?.id ? String(p.customer.id) : null,
    totalPrice: money(p.total_price),
    currency: p.presentment_currency ?? p.currency ?? "USD",
    lineItems: slimLineItems(p.line_items),
    recoveryUrl: p.abandoned_checkout_url ?? null,
    marketingConsent: Boolean(p.buyer_accepts_marketing),
  };
  const existing = await prisma.cart.findUnique({ where: { storeId_checkoutToken: { storeId, checkoutToken: String(token) } } });
  // Un carrito ya completado no vuelve a "abierto" por un aviso atrasado.
  const status = completed || existing?.status === "COMPLETED" || existing?.status === "RECOVERED" ? (existing?.status === "RECOVERED" ? "RECOVERED" : "COMPLETED") : (existing?.status ?? "OPEN");
  await prisma.cart.upsert({
    where: { storeId_checkoutToken: { storeId, checkoutToken: String(token) } },
    create: { storeId, checkoutToken: String(token), ...data, status, completedAt: completed ? new Date(p.completed_at) : null },
    update: { ...data, status, ...(completed && !existing?.completedAt ? { completedAt: new Date(p.completed_at) } : {}) },
  });
}

export async function handleOrderCreate(prisma: PrismaClient, storeId: string, p: Json) {
  if (!p.id) return;
  const checkoutToken = p.checkout_token ? String(p.checkout_token) : null;
  await prisma.order.upsert({
    where: { storeId_shopifyOrderId: { storeId, shopifyOrderId: String(p.id) } },
    create: {
      storeId,
      shopifyOrderId: String(p.id),
      checkoutToken,
      ...protectEmail(p.email ?? p.customer?.email),
      customerId: p.customer?.id ? String(p.customer.id) : null,
      totalPrice: money(p.total_price),
      currency: p.presentment_currency ?? p.currency ?? "USD",
      orderedAt: new Date(p.created_at ?? Date.now()),
    },
    update: {},
  });
  // Quien ya compró queda fuera de cualquier recuperación.
  if (checkoutToken) {
    const cart = await prisma.cart.findUnique({ where: { storeId_checkoutToken: { storeId, checkoutToken } } });
    if (cart && cart.status !== "COMPLETED" && cart.status !== "RECOVERED") {
      // Cuenta como recuperada solo si le enviamos el correo de recuperación antes de comprar.
      const emailed = await prisma.recoveryEmail.findFirst({ where: { cartId: cart.id, status: { in: ["SENT", "DRY_RUN"] } } });
      await prisma.cart.update({
        where: { id: cart.id },
        data: { status: emailed ? "RECOVERED" : "COMPLETED", completedAt: new Date() },
      });
    }
  }
}

export async function handleAppUninstalled(prisma: PrismaClient, storeId: string) {
  await prisma.store.update({
    where: { id: storeId },
    data: { status: "UNINSTALLED", accessTokenEnc: null, refreshTokenEnc: null, accessTokenExpiresAt: null, refreshTokenExpiresAt: null, uninstalledAt: new Date(), webPixelId: null },
  });
}

// Privacidad: Shopify pide borrar los datos de un cliente.
export async function handleCustomerRedact(prisma: PrismaClient, storeId: string, p: Json) {
  const email: string | undefined = p.customer?.email;
  const customerId = p.customer?.id ? String(p.customer.id) : undefined;
  const or: Prisma.CartWhereInput[] = [];
  if (email) or.push({ emailHash: blindIndex(normalizeEmail(email)) });
  if (customerId) or.push({ customerId });
  if (!or.length) return;
  await prisma.$transaction([
    prisma.cart.deleteMany({ where: { storeId, OR: or } }),
    prisma.order.updateMany({ where: { storeId, OR: or as Prisma.OrderWhereInput[] }, data: { emailEnc: null, emailHash: null, customerId: null } }),
    prisma.visitor.updateMany({ where: { storeId, OR: or as Prisma.VisitorWhereInput[] }, data: { emailEnc: null, emailHash: null, customerId: null } }),
  ]);
}

// Privacidad: 48 h después de desinstalar, Shopify pide borrar todos los datos de la tienda.
export async function handleShopRedact(prisma: PrismaClient, storeId: string) {
  await prisma.store.delete({ where: { id: storeId } });
}
