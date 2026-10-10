'use client'

import { useState } from 'react'
import { startMpCheckout } from '@/lib/mp-client'

export function PayWithMpButton({ orderNumber }: { orderNumber: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState('')

  async function pay() {
    setIsLoading(true)
    setError('')
    try {
      await startMpCheckout(orderNumber)
      // No se apaga el loading: el browser está navegando a MercadoPago.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar el pago')
      setIsLoading(false)
    }
  }

  return (
    <div>
      <button type="button" onClick={pay} disabled={isLoading} className="btn-primary w-full">
        {isLoading ? 'Abriendo MercadoPago…' : '💳 Pagar con MercadoPago'}
      </button>
      {error && <p role="alert" className="text-sm text-red-700 mt-2 text-center">{error}</p>}
    </div>
  )
}
