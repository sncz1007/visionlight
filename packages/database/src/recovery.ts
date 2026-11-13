import type { Cart, PrismaClient, Store } from "@prisma/client";

// Recuperación de carritos abandonados (paso 3).
// Reglas, en este orden:
// 1. Un carrito OPEN sin cambios durante `recoveryDelayMinutes` pasa a ABANDONED.
// 2. Solo se escribe a quien aceptó recibir marketing, tiene correo y enlace de recuperación.
// 3. Una persona recibe un solo correo por tienda cada 7 días, del carrito más reciente.
// 4. Nunca a quien se dio de baja ni a quien ya compró después de abandonar.

export const RECOVERY_WINDOW_DAYS = 7; // no escribimos por carritos más viejos que esto
const DAY = 24 * 60 * 60 * 1000;

export type RecoveryMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName: string;
  unsubscribeUrl: string;
};

export type RecoveryDeps = {
  decrypt: (value: string) => string;
  sign: (value: string) => string;
  /** URL pública de la API, para el enlace de baja. */
  appUrl: string;
  /** Envía el correo. Devuelve el id del proveedor, o null si es una prueba sin enviar (DRY_RUN). */
  send: (msg: RecoveryMessage) => Promise<string | null>;
  now?: Date;
};

type LineItem = { title: string; quantity: number; price: string };

export function unsubscribeToken(storeId: string, emailHash: string, sign: (v: string) => string) {
  const payload = `${storeId}.${emailHash}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function parseUnsubscribeToken(token: string, sign: (v: string) => string) {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const payload = Buffer.from(b64, "base64url").toString("utf8");
  if (sign(payload) !== sig) return null;
  const [storeId, emailHash] = payload.split(".");
  return storeId && emailHash ? { storeId, emailHash } : null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function buildRecoveryEmail(input: {
  storeName: string; firstName: string | null; items: LineItem[]; total: string; currency: string;
  recoveryUrl: string; unsubscribeUrl: string;
}) {
  const hello = input.firstName ? `Hola, ${input.firstName}` : "Hola";
  const total = `${Number(input.total).toLocaleString("es", { minimumFractionDigits: 2 })} ${input.currency}`;
  const subject = input.firstName ? `${input.firstName}, dejaste algo en tu carrito` : "Dejaste algo en tu carrito";
  const rows = input.items
    .slice(0, 10)
    .map((i) => `<tr><td style="padding:6px 0">${i.quantity} × ${esc(i.title)}</td><td style="padding:6px 0;text-align:right">${esc(i.price)}</td></tr>`)
    .join("");
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td>
<p style="margin:0 0 4px;font-size:13px;color:#6b7280">${esc(input.storeName)}</p>
<h1 style="margin:0 0 16px;font-size:22px">${esc(hello)} 👋</h1>
<p style="margin:0 0 16px;line-height:1.5">Vimos que dejaste estos productos en tu carrito. Los guardamos para que termines tu compra cuando quieras.</p>
<table role="presentation" width="100%" style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin:0 0 16px;font-size:14px">${rows}
<tr><td style="padding:8px 0;font-weight:bold">Total</td><td style="padding:8px 0;text-align:right;font-weight:bold">${esc(total)}</td></tr></table>
<p style="margin:0 0 24px;text-align:center"><a href="${esc(input.recoveryUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold">Completar mi compra</a></p>
<p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5">Recibes este correo porque aceptaste recibir novedades de ${esc(input.storeName)}.
<a href="${esc(input.unsubscribeUrl)}" style="color:#9ca3af">Darme de baja</a>.</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `${hello}.\n\nDejaste estos productos en tu carrito de ${input.storeName}:\n${input.items
    .map((i) => `- ${i.quantity} × ${i.title}`)
    .join("\n")}\nTotal: ${total}\n\nCompleta tu compra: ${input.recoveryUrl}\n\nDarme de baja: ${input.unsubscribeUrl}\n`;
  return { subject, html, text };
}

/** Marca carritos abandonados y envía los correos que tocan. Pensado para correr cada pocos minutos. */
export async function processAbandonedCarts(prisma: PrismaClient, deps: RecoveryDeps) {
  const now = deps.now ?? new Date();
  const stores = await prisma.store.findMany({ where: { status: "ACTIVE" } });
  const result = { abandoned: 0, sent: 0, dryRun: 0, skipped: 0, failed: 0 };

  for (const store of stores) {
    // 1) Abandono: se marca siempre (sirve para las estadísticas), aunque la recuperación esté apagada.
    const cutoff = new Date(now.getTime() - store.recoveryDelayMinutes * 60 * 1000);
    const marked = await prisma.cart.updateMany({
      where: { storeId: store.id, status: "OPEN", updatedAt: { lt: cutoff } },
      data: { status: "ABANDONED", abandonedAt: now },
    });
    result.abandoned += marked.count;
    if (!store.recoveryEnabled) continue;

    // 2) Candidatos: abandonados recientes, con consentimiento, correo y enlace, sin correo previo.
    const candidates = await prisma.cart.findMany({
      where: {
        storeId: store.id, status: "ABANDONED", marketingConsent: true,
        emailHash: { not: null }, emailEnc: { not: null }, recoveryUrl: { not: null },
        abandonedAt: { gte: new Date(now.getTime() - RECOVERY_WINDOW_DAYS * DAY) },
        recoveryEmail: null,
      },
      orderBy: { updatedAt: "desc" },
    });

    const seen = new Set<string>();
    for (const cart of candidates) {
      const hash = cart.emailHash!;
      // 3) Solo el carrito más reciente de cada persona; los demás quedan marcados como omitidos.
      if (seen.has(hash)) {
        await record(prisma, store, cart, "SKIPPED", null, "La persona tiene un carrito más reciente");
        result.skipped++;
        continue;
      }
      seen.add(hash);
      const reason = await skipReason(prisma, store, cart, now);
      if (reason) {
        await record(prisma, store, cart, "SKIPPED", null, reason);
        result.skipped++;
        continue;
      }
      const outcome = await sendOne(prisma, store, cart, deps);
      result[outcome]++;
    }
  }
  return result;
}

async function skipReason(prisma: PrismaClient, store: Store, cart: Cart, now: Date): Promise<string | null> {
  const hash = cart.emailHash!;
  if (await prisma.unsubscribe.findUnique({ where: { storeId_emailHash: { storeId: store.id, emailHash: hash } } })) {
    return "Se dio de baja";
  }
  const recent = await prisma.recoveryEmail.findFirst({
    where: { storeId: store.id, emailHash: hash, status: { in: ["SENT", "DRY_RUN"] }, sentAt: { gte: new Date(now.getTime() - RECOVERY_WINDOW_DAYS * DAY) } },
  });
  if (recent) return "Ya recibió un correo en los últimos 7 días";
  const bought = await prisma.order.findFirst({ where: { storeId: store.id, emailHash: hash, orderedAt: { gte: cart.createdAt } } });
  if (bought) return "Ya compró";
  return null;
}

async function sendOne(prisma: PrismaClient, store: Store, cart: Cart, deps: RecoveryDeps): Promise<"sent" | "dryRun" | "failed"> {
  const email = deps.decrypt(cart.emailEnc!);
  const fullName = cart.nameEnc ? deps.decrypt(cart.nameEnc) : null;
  const firstName = fullName ? fullName.split(" ")[0]!.replace(/^./, (c) => c.toUpperCase()) : null;
  // Registro de acceso a datos personales (ver docs/privacidad/seguridad.md §7).
  await prisma.auditLog.create({
    data: {
      action: "personal_data.accessed", organizationId: store.organizationId,
      metadata: { resource: "cart", recordIds: [cart.id], count: 1, purpose: "envío de correo de recuperación" },
    },
  });
  const unsubscribeUrl = `${deps.appUrl}/u/${unsubscribeToken(store.id, cart.emailHash!, deps.sign)}`;
  const content = buildRecoveryEmail({
    storeName: store.name ?? store.shopDomain, firstName,
    items: (cart.lineItems as LineItem[]) ?? [], total: cart.totalPrice.toString(), currency: cart.currency,
    recoveryUrl: cart.recoveryUrl!, unsubscribeUrl,
  });
  try {
    const providerId = await deps.send({ to: email, fromName: store.name ?? store.shopDomain, unsubscribeUrl, ...content });
    await record(prisma, store, cart, providerId ? "SENT" : "DRY_RUN", providerId, null);
    return providerId ? "sent" : "dryRun";
  } catch (err) {
    await record(prisma, store, cart, "FAILED", null, (err as Error).message.slice(0, 500));
    return "failed";
  }
}

function record(prisma: PrismaClient, store: Store, cart: Cart, status: "SENT" | "DRY_RUN" | "SKIPPED" | "FAILED", providerId: string | null, error: string | null) {
  return prisma.recoveryEmail.create({
    data: { storeId: store.id, cartId: cart.id, emailHash: cart.emailHash!, status, providerId, error },
  });
}
