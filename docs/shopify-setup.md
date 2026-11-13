# Conectar VISIONLIGHT con tu tienda de desarrollo

Guía para probar el paso 2 con una tienda Shopify real. Se hace una vez (y el paso 1 de nuevo cada vez que cambie la URL del túnel).

## 1. Abrir un túnel hacia tu API

Shopify necesita una dirección `https` pública para avisarnos. En desarrollo usamos un túnel gratuito:

```bash
# Instala cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:4000
```

Copia la URL `https://....trycloudflare.com` que aparece. La llamaremos **APP_URL**.

## 2. Crear la app en Shopify Dev

1. En https://dev.shopify.com entra en **Apps → Crear una app** y ponle de nombre **VISIONLIGHT**.
2. En **Settings** copia el **Client ID** y el **Client secret**.
3. En **API access → Protected customer data**, solicita acceso a *nombre, email y teléfono* (lo necesitamos para recuperar carritos). En tiendas de desarrollo se aprueba al momento.

## 3. Configurar el proyecto

En el archivo `.env` (raíz del proyecto):

```
APP_URL=https://....trycloudflare.com
SHOPIFY_API_KEY=<Client ID>
SHOPIFY_API_SECRET=<Client secret>
ENCRYPTION_KEY=<64 caracteres hex, ver .env.example>
```

En `apps/shopify-app/shopify.app.toml`, reemplaza `<APP_URL>` (el `client_id` ya está puesto).

## 4. Subir la configuración y el Web Pixel a Shopify

```bash
cd apps/shopify-app
npm install
npx shopify app deploy
```

Shopify CLI te pedirá iniciar sesión y elegir la app **VISIONLIGHT**.

## 5. Conectar la tienda

```bash
pnpm dev
```

Abre http://localhost:3000, entra al panel, escribe `visionlight-demo.myshopify.com` y pulsa **Conectar tienda Shopify**. Acepta los permisos en Shopify y volverás al panel con la tienda conectada.

Para comprobarlo, abre tu tienda en otra pestaña, mira productos, añade algo al carrito y empieza un pago: la actividad aparecerá en el panel.

> El Web Pixel respeta el consentimiento de cookies del visitante: si alguien rechaza analítica o marketing, no se registra su actividad.
