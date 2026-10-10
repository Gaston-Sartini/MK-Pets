import type { Metadata } from 'next'
import { LegalPage } from '@/components/layout/LegalPage'
import { whatsappLink } from '@/lib/shop'

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description: 'Qué datos personales usa MK-Pets, para qué y cómo ejercer tus derechos.',
}

export default function PrivacidadPage() {
  return (
    <LegalPage title="Política de privacidad" updated="10 de octubre de 2026">
      <section>
        <h2>1. Qué datos te pedimos</h2>
        <p>Solo los necesarios para llevarte el pedido. No hace falta crear una cuenta ni dejar un mail.</p>
        <ul>
          <li><strong>Al comprar:</strong> nombre, dirección de entrega, teléfono y, si querés, una nota para la entrega.</li>
          <li><strong>Sobre el pedido:</strong> productos, importe, medio de pago elegido y estado.</li>
          <li><strong>En el chat:</strong> los mensajes que escribís al asistente.</li>
        </ul>
        <p>No pedimos ni guardamos datos de tarjetas. Si pagás por transferencia, el comprobante lo recibimos por WhatsApp.</p>
      </section>

      <section>
        <h2>2. Para qué los usamos</h2>
        <ul>
          <li>Preparar, cobrar y entregar tu pedido.</li>
          <li>Avisarte por WhatsApp cómo va: confirmación, pago recibido, en camino, entregado.</li>
          <li>Atender consultas, cambios, devoluciones y reclamos.</li>
          <li>Cumplir obligaciones legales y contables.</li>
        </ul>
        <p>No usamos tu teléfono para mandarte publicidad y no vendemos ni cedemos tus datos a nadie.</p>
      </section>

      <section>
        <h2>3. Quién más interviene</h2>
        <p>Para que la tienda funcione usamos servicios de terceros que procesan datos por nuestra cuenta:</p>
        <ul>
          <li><strong>Alojamiento del sitio y base de datos</strong> (Netlify y Supabase): guardan los pedidos. Sus servidores pueden estar fuera de la Argentina.</li>
          <li><strong>WhatsApp:</strong> para los avisos y la atención.</li>
          <li><strong>Proveedor de inteligencia artificial:</strong> recibe lo que escribís en el chat para generar la respuesta. No le enviamos tu nombre, dirección ni teléfono. Evitá escribir datos personales en el chat.</li>
        </ul>
      </section>

      <section>
        <h2>4. Lo que queda en tu dispositivo</h2>
        <p>
          El carrito, el número de tu último pedido y la conversación del chat se guardan en tu
          navegador para que no los pierdas al recargar la página. No usamos cookies de publicidad ni
          herramientas que te sigan por otros sitios.
        </p>
      </section>

      <section>
        <h2>5. Quién puede ver tu pedido</h2>
        <p>
          La página de tu pedido muestra tu nombre, dirección y teléfono a quien tenga el número de
          pedido. Es un código largo y aleatorio: no lo compartas con quien no deba verlo.
        </p>
      </section>

      <section>
        <h2>6. Cuánto tiempo los guardamos</h2>
        <p>
          Conservamos los pedidos mientras sea necesario para atender garantías, devoluciones y
          obligaciones legales. Podés pedirnos que eliminemos tus datos antes, salvo los que la ley
          nos obligue a mantener.
        </p>
      </section>

      <section>
        <h2>7. Tus derechos</h2>
        <p>
          Podés pedirnos en cualquier momento ver qué datos tuyos tenemos, corregirlos o eliminarlos.
          Escribinos por <a href={whatsappLink('Hola! Quiero hacer una consulta sobre mis datos personales.')} target="_blank" rel="noopener noreferrer">WhatsApp</a>{' '}
          indicando tu número de pedido y te respondemos dentro de los 10 días corridos.
        </p>
        <p>
          La Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326 de
          Protección de los Datos Personales, atiende las denuncias y reclamos de quienes consideren
          que no se respetaron sus derechos:{' '}
          <a href="https://www.argentina.gob.ar/aaip" target="_blank" rel="noopener noreferrer">argentina.gob.ar/aaip</a>.
        </p>
      </section>

      <section>
        <h2>8. Cambios</h2>
        <p>Si modificamos esta política, publicamos la nueva versión en esta página con su fecha.</p>
      </section>
    </LegalPage>
  )
}
