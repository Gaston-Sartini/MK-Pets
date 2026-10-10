import type { Metadata } from 'next'
import Link from 'next/link'
import { whatsappLink } from '@/lib/shop'

export const metadata: Metadata = {
  title: 'Botón de arrepentimiento',
  description: 'Cancelá tu compra en MK-Pets dentro de los 10 días corridos de recibido el producto.',
}

export default function ArrepentimientoPage() {
  return (
    <div className="min-h-screen bg-mk-light py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-card shadow-card p-6 md:p-8">
        <h1 className="font-display font-bold text-2xl text-mk-dark mb-4">Botón de arrepentimiento</h1>

        <p className="text-mk-dark mb-3">
          Si compraste en MK-Pets y te arrepentiste, podés cancelar la compra dentro de los
          <strong> 10 días corridos</strong> desde que recibiste el producto, sin dar explicaciones
          y sin ningún costo.
        </p>
        <p className="text-mk-mid text-sm mb-6">
          El producto tiene que estar sin usar y en las mismas condiciones en que lo recibiste.
          Coordinamos el retiro y te devolvemos lo que pagaste por el mismo medio.
        </p>

        <h2 className="font-display font-bold text-lg text-mk-dark mb-2">Cómo pedirlo</h2>
        <ol className="list-decimal list-inside space-y-1 text-mk-dark text-sm mb-6">
          <li>Tené a mano tu número de pedido (empieza con <strong>MKP-</strong>).</li>
          <li>Tocá el botón de abajo y mandanos el mensaje por WhatsApp.</li>
          <li>Te respondemos con el código de tu trámite dentro de las 24 horas.</li>
        </ol>

        <a
          href={whatsappLink('Hola! Quiero arrepentirme de mi compra. Mi número de pedido es: MKP-')}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary w-full text-center block"
        >
          Quiero cancelar mi compra
        </a>

        <p className="text-xs text-mk-mid mt-6">
          Derecho de revocación: art. 34 de la Ley 24.240 de Defensa del Consumidor y art. 1110 del
          Código Civil y Comercial. Botón de arrepentimiento: Resolución 424/2020 de la Secretaría
          de Comercio Interior.
        </p>

        <Link href="/" className="btn-ghost w-full text-center block mt-4">Volver a la tienda</Link>
      </div>
    </div>
  )
}
