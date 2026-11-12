import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Términos y acuerdo de datos · VISIONLIGHT" };

export default function Terminos() {
  return (
    <LegalPage title="Términos y acuerdo de tratamiento de datos">
      <p>
        Estos Términos regulan el uso de {LEGAL.product}, de {LEGAL.company}, por parte del comerciante que crea una
        cuenta o instala la app en su tienda Shopify. Al aceptarlos, el comerciante acepta también el acuerdo de
        tratamiento de datos de la parte B.
      </p>

      <h2>A. Uso del servicio</h2>
      <ul>
        <li>El comerciante es responsable de la información de su cuenta y de mantener segura su contraseña.</li>
        <li>El comerciante debe informar a sus clientes, en la política de privacidad de su tienda, de que usa herramientas de analítica y de recuperación de carritos, y obtener los consentimientos que exija su legislación.</li>
        <li>No se permite usar el servicio para enviar comunicaciones a personas que no aceptaron recibir marketing, ni para fines ilegales.</li>
        <li>Los precios y la facturación se gestionan a través de Shopify. El comerciante puede cancelar en cualquier momento desinstalando la app.</li>
        <li>El servicio se ofrece &quot;tal cual&quot;. En la medida permitida por la ley, nuestra responsabilidad se limita a lo pagado por el comerciante en los 12 meses anteriores.</li>
      </ul>

      <h2>B. Acuerdo de tratamiento de datos</h2>
      <p>Respecto de los datos personales de los clientes de su tienda, el comerciante es el <b>responsable</b> y {LEGAL.company} es el <b>encargado</b> del tratamiento. Nos comprometemos a:</p>
      <ul>
        <li><b>Instrucciones:</b> tratar los datos solo para prestar el servicio descrito en la <Link className="text-indigo-600" href="/privacidad">Política de privacidad</Link> y según las instrucciones del comerciante.</li>
        <li><b>Minimización:</b> recoger solo los datos necesarios (correo, teléfono, nombre, contenido del carrito y del pedido) y no pedir direcciones ni datos de pago.</li>
        <li><b>Confidencialidad:</b> que solo accedan las personas que lo necesitan, sujetas a confidencialidad.</li>
        <li><b>Seguridad:</b> aplicar cifrado en tránsito y en reposo, control de acceso, registro de accesos, copias cifradas y separación de entornos.</li>
        <li><b>Subencargados:</b> usar solo proveedores con obligaciones equivalentes, publicar su lista y avisar antes de añadir uno nuevo, con derecho del comerciante a oponerse.</li>
        <li><b>Derechos de las personas:</b> ayudar al comerciante a responder solicitudes de acceso, corrección y borrado, incluidas las que llegan a través de Shopify.</li>
        <li><b>Incidentes:</b> notificar al comerciante cualquier violación de seguridad que afecte a sus datos sin demora indebida y en un máximo de 72 horas, con la información disponible.</li>
        <li><b>Fin del servicio:</b> borrar todos los datos de la tienda en un máximo de 30 días tras la desinstalación, salvo obligación legal de conservarlos.</li>
        <li><b>Auditoría:</b> facilitar la información necesaria para demostrar el cumplimiento de este acuerdo.</li>
      </ul>

      <h2>C. Cambios y contacto</h2>
      <p>Avisaremos por correo de cualquier cambio en estos Términos antes de que entre en vigor. Contacto: {LEGAL.contactEmail}.</p>
    </LegalPage>
  );
}
