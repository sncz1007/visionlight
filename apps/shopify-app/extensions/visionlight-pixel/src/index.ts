import { register } from "@shopify/web-pixels-extension";

// Eventos que le interesan a VISIONLIGHT (deben coincidir con TRACKED_EVENTS en la API).
const EVENTS = [
  "page_viewed", "product_viewed", "collection_viewed", "search_submitted",
  "product_added_to_cart", "product_removed_from_cart", "cart_viewed",
  "checkout_started", "checkout_contact_info_submitted", "checkout_completed",
];

register(({ analytics, browser, settings }) => {
  const key = settings.accountID as string;
  const url = settings.ingestUrl as string;
  if (!key || !url) return;

  let queue: unknown[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    if (!queue.length) return;
    const events = queue.splice(0, 20);
    browser.sendBeacon(url, JSON.stringify({ key, events }));
    if (queue.length) timer = setTimeout(flush, 0);
  };

  for (const name of EVENTS) {
    analytics.subscribe(name, (event: any) => {
      queue.push({
        id: event.id,
        name: event.name,
        clientId: event.clientId,
        timestamp: event.timestamp,
        url: event.context?.document?.location?.href,
        data: slim(event.name, event.data),
      });
      // Agrupa eventos cercanos; el inicio y fin de pago se envían de inmediato.
      if (name.startsWith("checkout_")) flush();
      else if (!timer) timer = setTimeout(flush, 1500);
    });
  }
});

// Solo enviamos los datos necesarios de cada evento.
function slim(name: string, data: any) {
  if (!data) return undefined;
  if (data.productVariant) {
    const v = data.productVariant;
    return { productId: v.product?.id, variantId: v.id, title: v.product?.title, price: v.price?.amount, currency: v.price?.currencyCode };
  }
  if (data.cartLine) {
    const l = data.cartLine;
    return { variantId: l.merchandise?.id, title: l.merchandise?.product?.title, quantity: l.quantity, price: l.cost?.totalAmount?.amount };
  }
  if (data.checkout) {
    const c = data.checkout;
    return { checkoutToken: c.token, total: c.totalPrice?.amount, currency: c.currencyCode, orderId: c.order?.id ?? null };
  }
  if (name === "search_submitted") return { query: data.searchResult?.query };
  return undefined;
}
