import { config } from "../lib/config.js";

export class ShopifyAdmin {
  constructor(private shop: string, private accessToken: string) {}

  async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const res = await fetch(`https://${this.shop}/admin/api/${config.shopify.apiVersion}/graphql.json`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-shopify-access-token": this.accessToken },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`Shopify GraphQL respondió ${res.status}`);
    const body = (await res.json()) as { data?: T; errors?: unknown };
    if (body.errors || !body.data) throw new Error(`Shopify GraphQL: ${JSON.stringify(body.errors)}`);
    return body.data;
  }

  async getShopInfo() {
    const data = await this.graphql<{ shop: { name: string; currencyCode: string } }>(
      `query { shop { name currencyCode } }`,
    );
    return data.shop;
  }
}

// Temas de webhooks que la app necesita. Los de privacidad (GDPR) se declaran en shopify.app.toml.
export const WEBHOOK_TOPICS = ["CHECKOUTS_CREATE", "CHECKOUTS_UPDATE", "ORDERS_CREATE", "APP_UNINSTALLED"] as const;

export async function registerWebhooks(admin: ShopifyAdmin): Promise<string[]> {
  const errors: string[] = [];
  for (const topic of WEBHOOK_TOPICS) {
    const data = await admin.graphql<{
      webhookSubscriptionCreate: { userErrors: { message: string }[] };
    }>(
      `mutation($topic: WebhookSubscriptionTopic!, $uri: String!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: { uri: $uri, format: JSON }) {
          userErrors { message }
        }
      }`,
      { topic, uri: `${config.appUrl}/webhooks/shopify` },
    );
    for (const e of data.webhookSubscriptionCreate.userErrors) {
      // "already been taken" significa que ya existía: no es un error real.
      if (!/taken/i.test(e.message)) errors.push(`${topic}: ${e.message}`);
    }
  }
  return errors;
}

export async function createWebPixel(admin: ShopifyAdmin, pixelKey: string): Promise<string | null> {
  const settings = { accountID: pixelKey, ingestUrl: `${config.appUrl}/ingest/pixel` };
  const data = await admin.graphql<{
    webPixelCreate: { webPixel: { id: string } | null; userErrors: { message: string; code: string }[] };
  }>(
    `mutation($webPixel: WebPixelInput!) {
      webPixelCreate(webPixel: $webPixel) { webPixel { id } userErrors { message code } }
    }`,
    { webPixel: { settings } },
  );
  if (data.webPixelCreate.webPixel) return data.webPixelCreate.webPixel.id;
  // Si ya existe un pixel (reinstalación), lo actualizamos con la clave nueva.
  if (data.webPixelCreate.userErrors.some((e) => e.code === "TAKEN")) {
    const upd = await admin.graphql<{ webPixelUpdate: { webPixel: { id: string } | null } }>(
      `mutation($webPixel: WebPixelInput!) { webPixelUpdate(webPixel: $webPixel) { webPixel { id } } }`,
      { webPixel: { settings } },
    );
    return upd.webPixelUpdate.webPixel?.id ?? null;
  }
  throw new Error(`webPixelCreate: ${JSON.stringify(data.webPixelCreate.userErrors)}`);
}
