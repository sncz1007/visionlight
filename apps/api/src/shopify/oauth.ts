import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../lib/config.js";

const SHOP_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

// Acepta "mitienda", "mitienda.myshopify.com" o "https://mitienda.myshopify.com/".
export function normalizeShopDomain(input: string): string | null {
  let shop = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!shop.includes(".")) shop = `${shop}.myshopify.com`;
  return SHOP_RE.test(shop) ? shop : null;
}

export function isValidShopDomain(shop: unknown): shop is string {
  return typeof shop === "string" && SHOP_RE.test(shop);
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Verifica la firma que Shopify añade a la URL de retorno del OAuth.
export function verifyQueryHmac(query: Record<string, string | string[] | undefined>, secret = config.shopify.apiSecret): boolean {
  const { hmac, signature: _sig, ...rest } = query;
  if (typeof hmac !== "string" || !secret) return false;
  const message = Object.keys(rest)
    .sort()
    .map((k) => {
      const v = rest[k];
      return `${k}=${Array.isArray(v) ? v.join(",") : (v ?? "")}`;
    })
    .join("&");
  const digest = createHmac("sha256", secret).update(message).digest("hex");
  return safeEqualHex(digest, hmac);
}

// Verifica la firma de un webhook (cabecera X-Shopify-Hmac-Sha256 sobre el cuerpo original).
export function verifyWebhookHmac(rawBody: Buffer, header: string | undefined, secret = config.shopify.apiSecret): boolean {
  if (!header || !secret) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest("base64");
  return safeEqualHex(digest, header);
}

export function buildAuthorizeUrl(shop: string, nonce: string): string {
  const params = new URLSearchParams({
    client_id: config.shopify.apiKey,
    scope: config.shopify.scopes,
    redirect_uri: `${config.appUrl}/shopify/callback`,
    state: nonce,
  });
  return `https://${shop}/admin/oauth/authorize?${params}`;
}

export type ShopifyTokens = {
  accessToken: string;
  scope: string;
  accessTokenExpiresAt: Date | null;
  refreshToken: string | null;
  refreshTokenExpiresAt: Date | null;
};

async function requestToken(shop: string, params: Record<string, string>): Promise<ShopifyTokens> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ client_id: config.shopify.apiKey, client_secret: config.shopify.apiSecret, ...params }).toString(),
  });
  if (!res.ok) throw new Error(`Shopify rechazó la solicitud de token (${res.status}): ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const body = (await res.json()) as {
    access_token?: string; scope?: string; expires_in?: number; refresh_token?: string; refresh_token_expires_in?: number;
  };
  if (!body.access_token) throw new Error("Shopify no devolvió un token de acceso");
  const inSeconds = (s?: number) => (typeof s === "number" ? new Date(Date.now() + s * 1000) : null);
  return {
    accessToken: body.access_token,
    scope: body.scope ?? "",
    accessTokenExpiresAt: inSeconds(body.expires_in),
    refreshToken: body.refresh_token ?? null,
    refreshTokenExpiresAt: inSeconds(body.refresh_token_expires_in),
  };
}

/** Cambia el código OAuth por un token offline que vence (expiring=1), como exige Shopify. */
export function exchangeCodeForToken(shop: string, code: string): Promise<ShopifyTokens> {
  return requestToken(shop, { code, expiring: "1" });
}

/** Renueva un token vencido o por vencer. Shopify devuelve también un refresh token nuevo. */
export function refreshAccessToken(shop: string, refreshToken: string): Promise<ShopifyTokens> {
  return requestToken(shop, { grant_type: "refresh_token", refresh_token: refreshToken });
}
