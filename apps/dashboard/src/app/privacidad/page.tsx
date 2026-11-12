import { LegalPage } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Política de privacidad · VISIONLIGHT" };

export default function Privacidad() {
  return (
    <LegalPage title="Política de privacidad">
      <p>
        {LEGAL.product} es una aplicación de {LEGAL.company} (&quot;nosotros&quot;) que ayuda a tiendas Shopify
        (&quot;comerciantes&quot;) a medir la actividad de su tienda y recuperar carritos abandonados. Esta política explica
        qué datos personales tratamos, para qué y cómo los protegemos.
      </p>

      <h2>1. Nuestro papel</h2>
      <p>
        Para los datos de los clientes de cada tienda actuamos como <b>encargado del tratamiento</b>: los tratamos solo
        por cuenta del comerciante y según sus instrucciones, recogidas en los Términos y el acuerdo de tratamiento de
        datos. Para los datos de las cuentas de los comerciantes (nombre, correo, contraseña) somos responsables.
      </p>

      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li><b>Cuenta del comerciante:</b> nombre, correo, contraseña (guardada solo como hash bcrypt), empresa y registros de acceso.</li>
        <li><b>Tienda:</b> dominio, nombre, moneda y un token de acceso de Shopify, guardado cifrado.</li>
        <li><b>Clientes de la tienda que inician un pago:</b> correo y teléfono (cifrados), identificador de cliente, productos del carrito, importe, enlace de recuperación y si aceptaron recibir marketing.</li>
        <li><b>Pedidos:</b> identificador, importe, fecha y correo (cifrado), para saber qué carritos se recuperaron.</li>
        <li><b>Navegación en la tienda:</b> páginas y productos vistos, productos añadidos al carrito e inicio de pago, asociados a un identificador anónimo del navegador. Solo se recogen si el visitante dio su consentimiento de analítica y marketing en la tienda.</li>
      </ul>
      <p>No pedimos direcciones postales ni datos de pago, y no tratamos categorías especiales de datos.</p>

      <h2>3. Para qué los usamos</h2>
      <ul>
        <li>Mostrar al comerciante la actividad de su tienda.</li>
        <li>Detectar carritos abandonados y, solo si el cliente aceptó recibir marketing, enviarle recordatorios por correo en nombre de la tienda.</li>
        <li>Medir qué ventas se recuperaron.</li>
        <li>Seguridad, prevención de abusos y cumplimiento legal.</li>
      </ul>
      <p>No vendemos datos personales, no los usamos para publicidad propia y no los compartimos con otras tiendas. No tomamos decisiones automatizadas con efectos legales sobre las personas.</p>

      <h2>4. Consentimiento</h2>
      <p>
        Respetamos las decisiones de privacidad del visitante en la tienda (Shopify Customer Privacy): si no acepta
        analítica y marketing, o si se opone a la venta de sus datos, nuestro pixel no recoge nada. Solo enviamos correos de
        recuperación a clientes que aceptaron recibir marketing, y cada correo incluye un enlace para darse de baja.
      </p>

      <h2>5. Con quién los compartimos</h2>
      <p>
        Con proveedores que nos ayudan a prestar el servicio (alojamiento y base de datos, envío de correos), sujetos a
        contratos de confidencialidad y seguridad, y con autoridades cuando la ley lo exija. Publicaremos aquí la lista de
        subencargados y avisaremos a los comerciantes antes de añadir uno nuevo.
      </p>

      <h2>6. Cuánto tiempo los guardamos</h2>
      <ul>
        <li>Eventos de navegación y visitantes: 90 días.</li>
        <li>Carritos (incluidos correo y teléfono): 90 días desde su última actualización.</li>
        <li>Pedidos: 12 meses.</li>
        <li>Registros de auditoría y de acceso: 24 meses.</li>
        <li>Al desinstalar la app borramos el token de acceso al instante y todos los datos de la tienda en un máximo de 30 días (normalmente a las 48 horas, cuando Shopify lo solicita).</li>
      </ul>
      <p>Un proceso automático borra cada día lo que superó su plazo.</p>

      <h2>7. Cómo los protegemos</h2>
      <ul>
        <li>Cifrado en tránsito (HTTPS) y cifrado AES-256-GCM de tokens, correos y teléfonos en la base de datos.</li>
        <li>Cada comerciante solo ve los datos de sus propias tiendas.</li>
        <li>Acceso del equipo limitado a quien lo necesita, con contraseñas robustas y doble factor en los sistemas de producción.</li>
        <li>Registro de cada acceso a datos personales.</li>
        <li>Copias de seguridad cifradas y entornos de prueba separados de producción, sin datos reales.</li>
        <li>Plan de respuesta ante incidentes: avisamos a los comerciantes afectados sin demora indebida y en un máximo de 72 horas.</li>
      </ul>

      <h2>8. Derechos de las personas</h2>
      <p>
        Los clientes de una tienda pueden pedir acceso, corrección o borrado de sus datos a la propia tienda; Shopify nos
        transmite esas solicitudes y las atendemos (el borrado es automático). También pueden escribirnos a{" "}
        <b>{LEGAL.contactEmail}</b> y les ayudaremos o les remitiremos a la tienda. Los comerciantes pueden borrar su cuenta
        escribiendo a la misma dirección.
      </p>

      <h2>9. Cambios</h2>
      <p>Si cambiamos esta política, actualizaremos la versión de arriba y avisaremos a los comerciantes por correo antes de que el cambio entre en vigor.</p>

      <h2>10. Contacto</h2>
      <p>{LEGAL.company} · {LEGAL.contactEmail}</p>
    </LegalPage>
  );
}
