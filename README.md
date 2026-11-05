# VISIONLIGHT

Plataforma SaaS de recuperación de ventas para tiendas Shopify (VISIONLIGHT Commerce), por LIGHT.

## Estructura

```text
apps/
  api/        API en Fastify (registro, sesiones, empresas, roles)
  dashboard/  Panel web en Next.js + Tailwind
  worker/     Tareas en segundo plano con BullMQ + Redis
packages/
  database/   Esquema Prisma y cliente de PostgreSQL
  shared/     Validaciones y tipos compartidos (zod)
```

Las carpetas `shopify`, `tracking`, `automation`, `billing`, etc. se crean cuando lleguemos a esas fases.

## Requisitos

- Node.js 22 o más reciente
- pnpm 10 (`npm install -g pnpm`)
- Docker Desktop (para PostgreSQL y Redis)

## Arrancar en tu computadora

```bash
cp .env.example .env          # en Windows: copy .env.example .env
docker compose up -d          # levanta PostgreSQL y Redis
pnpm install
pnpm db:migrate               # crea las tablas
pnpm dev                      # API en :4000, panel en :3000, worker
```

Abre http://localhost:3000, crea una cuenta y entrarás al panel.

## Pruebas

```bash
pnpm typecheck
pnpm test        # requiere la base de datos levantada
```

## Seguridad ya incluida

- Contraseñas con bcrypt; sesiones con token aleatorio en cookie `httpOnly` (la base guarda solo su HMAC).
- Cada ruta `/orgs/:orgId/...` verifica que el usuario pertenezca a esa empresa y tenga el rol necesario.
- Límite de peticiones (estricto en login y registro), cabeceras de seguridad (helmet) y CORS restringido al panel.
- Registro de auditoría de registros, inicios de sesión y cambios de miembros.

## Plan

1. **Base** (esta versión): monorepo, base de datos, registro, empresas y roles.
2. **Shopify**: app con OAuth, Web Pixel y webhooks; panel de actividad.
3. **Recuperación**: carritos abandonados, emails, exclusión de compradores, ingresos recuperados.
4. **Cobro y venta**: Shopify Billing, página de ventas, primeros clientes.
