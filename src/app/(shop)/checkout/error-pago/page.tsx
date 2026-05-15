'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'

function PaymentErrorContent() {
  const params      = useSearchParams()
  const orderNumber = params.get('order')

  return (
    <main className="min-h-screen bg-mk-light flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-card shadow-card p-8 text-center">
        <div className="text-5xl mb-4">😿</div>
        <h1 className="text-xl font-bold text-mk-dark mb-2">Hubo un problema con el pago</h1>
        <p className="text-mk-mid text-sm mb-6">
          No se realizó ningún cobro. Podés intentarlo de nuevo o elegir pagar al recibir.
        </p>

        <div className="flex flex-col gap-3">
          {orderNumber ? (
            <>
              <Link href={`/pedido/${orderNumber}`} className="btn-primary">
                Ver mi pedido
              </Link>
              <Link href="/checkout" className="btn-secondary">
                Intentar de nuevo
              </Link>
            </>
          ) : (
            <Link href="/" className="btn-primary">
              Volver al inicio
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}

export default function PaymentErrorPage() {
  return (
    <Suspense fallback={null}>
      <PaymentErrorContent />
    </Suspense>
  )
}
