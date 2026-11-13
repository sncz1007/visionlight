function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

const isProd = process.env.NODE_ENV === "production";

export const config = {
  isProd,
  port: Number(process.env.API_PORT ?? 4000),
  sessionSecret: required("SESSION_SECRET", isProd ? undefined : "dev-only-secret-change-me"),
  dashboardUrl: process.env.DASHBOARD_URL ?? "http://localhost:3000",
  sessionDays: 30,
  cookieName: "vl_session",
  // URL pública de la API (Shopify llama aquí: OAuth, webhooks y Web Pixel).
  appUrl: (process.env.APP_URL ?? "http://localhost:4000").replace(/\/$/, ""),
  // 32 bytes en hexadecimal (64 caracteres) para cifrar los tokens de las tiendas.
  encryptionKey: required("ENCRYPTION_KEY", isProd ? undefined : "0".repeat(64)),
  shopify: {
    apiKey: process.env.SHOPIFY_API_KEY ?? "",
    apiSecret: process.env.SHOPIFY_API_SECRET ?? "",
    scopes: process.env.SHOPIFY_SCOPES ?? "read_products,read_orders,read_customers,write_pixels,read_customer_events",
    apiVersion: process.env.SHOPIFY_API_VERSION ?? "2026-10",
  },
};

export function shopifyConfigured(): boolean {
  return Boolean(config.shopify.apiKey && config.shopify.apiSecret);
}

if (!/^[0-9a-f]{64}$/i.test(config.encryptionKey)) {
  throw new Error("ENCRYPTION_KEY debe ser de 64 caracteres hexadecimales (32 bytes)");
}

if (isProd && config.sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET debe tener al menos 32 caracteres en producción");
}
