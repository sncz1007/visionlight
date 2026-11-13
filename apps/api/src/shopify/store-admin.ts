import type { PrismaClient, Store } from "@visionlight/database";
import { decrypt, encrypt } from "../lib/crypto.js";
import { ShopifyAdmin } from "./admin.js";
import { refreshAccessToken, type ShopifyTokens } from "./oauth.js";

// Renovamos con 5 minutos de margen para no usar un token a punto de vencer.
const MARGIN_MS = 5 * 60 * 1000;

/** Campos de la tienda para guardar un par de tokens (siempre cifrados). */
export function tokenFields(t: ShopifyTokens) {
  return {
    accessTokenEnc: encrypt(t.accessToken),
    accessTokenExpiresAt: t.accessTokenExpiresAt,
    refreshTokenEnc: t.refreshToken ? encrypt(t.refreshToken) : null,
    refreshTokenExpiresAt: t.refreshTokenExpiresAt,
  };
}

/** Cliente de la Admin API para una tienda, renovando el token si venció o está por vencer. */
export async function adminForStore(prisma: PrismaClient, store: Store): Promise<ShopifyAdmin> {
  if (store.status !== "ACTIVE" || !store.accessTokenEnc) throw new Error("La tienda no está conectada");
  const expiresSoon = store.accessTokenExpiresAt && store.accessTokenExpiresAt.getTime() - Date.now() < MARGIN_MS;
  if (!expiresSoon) return new ShopifyAdmin(store.shopDomain, decrypt(store.accessTokenEnc));

  if (!store.refreshTokenEnc || (store.refreshTokenExpiresAt && store.refreshTokenExpiresAt < new Date())) {
    throw new Error("El acceso a la tienda venció: hay que reconectarla desde el panel");
  }
  const tokens = await refreshAccessToken(store.shopDomain, decrypt(store.refreshTokenEnc));
  await prisma.store.update({ where: { id: store.id }, data: tokenFields(tokens) });
  return new ShopifyAdmin(store.shopDomain, tokens.accessToken);
}
