import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/layout/LegalPage'
import { whatsappLink } from '@/lib/shop'

export const metadata: Metadata = {
  title: 'Términos y condiciones',
  description: 'Condiciones de compra en MK-Pets: precios, pagos, envíos, cambios y devoluciones.',
}

export default function TerminosPage() {
  return (
    <LegalPage title="Términos y condiciones" updated="10 de octubre de 2026">
      <section>
        <h2>1. Quiénes somos</h2>
        <p>
          MK-Pets es una tienda online de alimentos y productos para mascotas con entrega a domicilio
          en la Ciudad Autónoma de Buenos Aires. Al hacer un pedido en este sitio aceptás estas
          condiciones. Si tenés dudas antes de comprar, <a href={whatsappLink()} target="_blank" rel="noopener noreferrer">escribinos por WhatsApp</a>.
        </p>
      </section>

      <section>
        <h2>2. Productos y precios</h2>
        <ul>
          <li>Los precios están en pesos argentinos e incluyen impuestos.</li>
          <li>El precio que vale es el que figura en el sitio al momento de confirmar el pedido.</li>
          <li>Las fotos son ilustrativas: el envase puede variar según el lote del fabricante.</li>
          <li>La disponibilidad depende del stock. Si por un error no podemos entregarte un producto, te avisamos y te devolvemos lo que hayas pagado por él.</li>
        </ul>
      </section>

      <section>
        <h2>3. Cómo se hace un pedido</h2>
        <p>
          Agregás productos al carrito, elegís el medio de pago y completás tus datos de entrega.
          No hace falta crear una cuenta. Al confirmar te damos un número de pedido (empieza con
          <strong> MKP-</strong>) con el que podés ver el estado en cualquier momento. Guardalo: es la
          llave para consultar tu pedido.
        </p>
        <p>
          Podés modificar las cantidades durante los 30 minutos posteriores a la compra, siempre que
          todavía no hayamos empezado a prepararlo.
        </p>
      </section>

      <section>
        <h2>4. Medios de pago</h2>
        <ul>
          <li><strong>Transferencia:</strong> el pedido queda reservado y lo confirmamos cuando recibimos el comprobante.</li>
          <li><strong>Efectivo:</strong> pagás al recibir el pedido.</li>
        </ul>
        <p>Si elegís transferencia y no recibimos el pago en un plazo razonable, podemos cancelar el pedido y liberar los productos.</p>
      </section>

      <section>
        <h2>5. Envíos</h2>
        <ul>
          <li>Entregamos en la Ciudad Autónoma de Buenos Aires, sin costo.</li>
          <li>Coordinamos día y horario por WhatsApp una vez confirmado el pedido.</li>
          <li>Si no hay nadie para recibirlo en el horario acordado, reprogramamos la entrega.</li>
        </ul>
      </section>

      <section>
        <h2>6. Arrepentimiento, cambios y devoluciones</h2>
        <p>
          Tenés 10 días corridos desde que recibís el producto para arrepentirte de la compra, sin
          dar explicaciones y sin costo. Los detalles y el botón para pedirlo están en{' '}
          <Link href="/arrepentimiento">Botón de arrepentimiento</Link>.
        </p>
        <p>
          Si el producto llegó dañado, vencido o no es el que pediste, avisanos apenas lo recibas y
          lo cambiamos o te devolvemos el dinero, a tu elección.
        </p>
      </section>

      <section>
        <h2>7. Asistente virtual</h2>
        <p>
          El chat de la tienda es un asistente automático con inteligencia artificial. Sirve para
          encontrar productos, pero puede equivocarse: el precio y el stock válidos son los que ves
          en la ficha del producto y en el carrito. No reemplaza el consejo de un veterinario.
        </p>
      </section>

      <section>
        <h2>8. Datos personales</h2>
        <p>
          Usamos tus datos solo para gestionar tu pedido. El detalle está en la{' '}
          <Link href="/privacidad">Política de privacidad</Link>.
        </p>
      </section>

      <section>
        <h2>9. Reclamos y ley aplicable</h2>
        <p>
          Estas condiciones se rigen por las leyes de la República Argentina, en particular la Ley
          24.240 de Defensa del Consumidor. Ante cualquier problema, escribinos primero: casi todo se
          resuelve hablando. También podés iniciar un reclamo en la{' '}
          <a href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario" target="_blank" rel="noopener noreferrer">
            Ventanilla Única Federal de Defensa del Consumidor
          </a>.
        </p>
        <p>Podemos actualizar estas condiciones. A cada pedido se le aplican las vigentes el día en que se hizo.</p>
      </section>
    </LegalPage>
  )
}
