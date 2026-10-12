import type { Metadata } from 'next'
import { TrackOrderForm } from '@/components/order/TrackOrderForm'
import { whatsappLink } from '@/lib/shop'

export const metadata: Metadata = {
  title: 'Seguí tu pedido',
  description: 'Ingresá tu número de pedido de MK-Pets para ver en qué estado está.',
  robots: { index: false, follow: true },
}

export default function TrackOrderPage() {
  return (
    <main className="min-h-screen bg-mk-light py-10 px-4">
      <div className="max-w-md mx-auto bg-white rounded-card shadow-card p-6 md:p-8">
        <h1 className="font-display font-bold text-2xl text-mk-dark mb-2">Seguí tu pedido</h1>
        <p className="text-sm text-mk-mid mb-6">
          Ingresá el número que te dimos al comprar. Empieza con <strong>MKP-</strong> y está en el
          WhatsApp de confirmación.
        </p>

        <TrackOrderForm />

        <p className="mt-6 pt-5 border-t border-gray-100 text-sm text-mk-mid text-center">
          ¿No lo encontrás?{' '}
          <a
            href={whatsappLink('Hola! Quiero consultar por un pedido y no tengo el número.')}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-mk-orange hover:underline"
          >
            Escribinos por WhatsApp
          </a>
        </p>
      </div>
    </main>
  )
}
