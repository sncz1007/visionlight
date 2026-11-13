# Política de seguridad de datos

Versión 2026-11-12. Responsable: el propietario de la cuenta de VISIONLIGHT (hoy, el fundador).

## 1. Cifrado
- **En tránsito:** todo el tráfico público va por HTTPS (TLS). La API rechaza webhooks sin firma HMAC válida.
- **En reposo:** tokens de Shopify, correos y teléfonos de clientes se cifran con AES-256-GCM antes de guardarse (`apps/api/src/lib/crypto.ts`). Los correos llevan además un índice ciego (HMAC) para poder buscarlos sin descifrar. La clave (`ENCRYPTION_KEY`) vive solo en las variables de entorno del servidor, nunca en el repositorio.
- Las contraseñas de los comerciantes se guardan con bcrypt (coste 12); las sesiones, solo como HMAC del token.

## 2. Acceso del equipo
- Solo acceden a producción las personas que lo necesitan para operar el servicio; hoy, una persona.
- Cada comerciante solo ve sus propias tiendas (`requireOrgRole`, 404 para el resto).
- Nadie consulta datos personales de producción salvo para soporte o un incidente, y queda registrado.
- Al salir alguien del equipo se le retiran los accesos el mismo día y se rotan los secretos que conociera.

## 3. Contraseñas y cuentas
- Comerciantes: mínimo 12 caracteres, no repetitivas ni comunes; límite de intentos de inicio de sesión.
- Equipo: contraseñas únicas de 16+ caracteres en gestor de contraseñas y **doble factor obligatorio** en GitHub, Shopify Partners, el proveedor de alojamiento y el de correo.
- Los secretos (`.env`) nunca se comparten por chat ni en capturas; si ocurre, se rotan.

## 4. Copias de seguridad
- Producción usa una base de datos gestionada con cifrado en reposo y copias diarias cifradas por el proveedor, retenidas 30 días.
- Los campos personales ya van cifrados por la app, así que también lo están dentro de cualquier copia.
- Se prueba restaurar una copia al menos una vez por trimestre.

## 5. Separación de prueba y producción
- Desarrollo y pruebas usan bases de datos locales y tiendas de desarrollo de Shopify con datos ficticios.
- Producción tiene su propia base, sus propias claves (`SESSION_SECRET`, `ENCRYPTION_KEY`) y su propia app de Shopify o configuración; nunca se copian datos de producción a desarrollo.

## 6. Prevención de pérdida de datos
- Minimización: no se guarda lo que no se necesita (sin direcciones ni datos de pago).
- Las exportaciones de datos personales no están permitidas fuera de una solicitud de un comerciante o cliente.
- Copias diarias (§4) y migraciones de base de datos revisadas en un pull request antes de aplicarse.
- Dependencias actualizadas y alertas de seguridad de GitHub activadas.

## 7. Registro de accesos
- Toda lectura de datos personales descifrados pasa por `logPersonalDataAccess`, que deja en la auditoría quién, cuándo, qué registros y para qué.
- La auditoría guarda también inicios de sesión, conexión/desconexión de tiendas y solicitudes de privacidad, y se conserva 24 meses.
