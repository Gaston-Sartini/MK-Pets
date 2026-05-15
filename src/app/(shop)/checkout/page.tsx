'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCartStore } from '@/store/cart-store'
import { useToastStore } from '@/store/toast-store'
import { cacheOrderNumber } from '@/lib/order-cache'
import { formatPrice } from '@/lib/utils'
import { StepIndicator }      from '@/components/checkout/StepIndicator'
import { PaymentSelector }    from '@/components/checkout/PaymentSelector'
import { DeliveryForm }       from '@/components/checkout/DeliveryForm'
import { OrderSummaryPanel }  from '@/components/checkout/OrderSummaryPanel'
import type { DeliveryFormData } from '@/lib/validations/checkout'

type PaymentMethod = 'MERCADOPAGO' | 'CASH_ON_DELIVERY'

export default function CheckoutPage() {
  const router = useRouter()
  const { items, totalPrice, clearCart } = useCartStore()
  const { addToast } = useToastStore()

  const [step, setStep]                   = useState<1 | 2>(1)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [isLoading, setIsLoading]         = useState(false)

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0) {
      router.replace('/')
    }
  }, [items.length, router])

  if (items.length === 0) return null

  function handleNextStep() {
    if (!paymentMethod) {
      addToast({ type: 'error', message: 'Seleccioná un método de pago para continuar' })
      return
    }
    setStep(2)
  }

  async function handleSubmitOrder(data: DeliveryFormData) {
    setIsLoading(true)

    try {
      // 1. Create order
      const orderRes = await fetch('/api/pedidos', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod,
          customerName: data.customerName,
          address:      data.address,
          phone:        data.phone,
          notes:        data.notes,
          items: items.map(i => ({
            productId:    i.productId,
            variantLabel: i.variantLabel,
            quantity:     i.quantity,
            unitPrice:    i.unitPrice,
          })),
        }),
      })

      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}))
        throw new Error(err.error ?? 'Error al crear el pedido')
      }

      const { orderNumber } = await orderRes.json()

      // 2. Cache order number on device
      cacheOrderNumber(orderNumber)
      clearCart()

      // 3. If MercadoPago, get preference and redirect
      if (paymentMethod === 'MERCADOPAGO') {
        const mpRes = await fetch('/api/pagos/crear-preferencia', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNumber,
            items: items.map(i => ({
              id:         i.productId,
              title:      i.name + (i.variantLabel ? ` (${i.variantLabel})` : ''),
              quantity:   i.quantity,
              unit_price: i.unitPrice,
            })),
            total: totalPrice(),
          }),
        })

        if (!mpRes.ok) throw new Error('Error al iniciar el pago con MercadoPago')

        const { initPoint, sandboxUrl } = await mpRes.json()
        const redirectUrl = process.env.NODE_ENV === 'production' ? initPoint : sandboxUrl
        window.location.href = redirectUrl
        return
      }

      // 4. Cash on delivery — go directly to order page
      router.push(`/pedido/${orderNumber}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ocurrió un error inesperado'
      addToast({ type: 'error', message: msg })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-mk-light py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-mk-mid hover:text-mk-orange transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver al catálogo
        </Link>

        <h1 className="text-2xl font-bold text-mk-dark mb-6">Checkout</h1>

        <StepIndicator currentStep={step} />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Main column */}
          <div className="bg-white rounded-card shadow-card p-6">
            {step === 1 && (
              <>
                <PaymentSelector selected={paymentMethod} onChange={setPaymentMethod} />
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="btn-primary w-full mt-6"
                >
                  Continuar con datos de entrega →
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1 text-sm text-mk-mid hover:text-mk-orange transition-colors mb-5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Cambiar método de pago
                </button>

                {paymentMethod === 'MERCADOPAGO' && (
                  <div className="mb-5 flex items-center gap-2 bg-blue-50 text-blue-700 rounded-chip px-4 py-2 text-sm font-medium">
                    <span>💳</span> Pagás con MercadoPago después de confirmar
                  </div>
                )}

                {paymentMethod === 'CASH_ON_DELIVERY' && (
                  <div className="mb-5 flex items-center gap-2 bg-mk-green-pale text-mk-green rounded-chip px-4 py-2 text-sm font-medium">
                    <span>🤝</span> Pagás al recibir tu pedido
                  </div>
                )}

                <DeliveryForm onSubmit={handleSubmitOrder} isLoading={isLoading} />
              </>
            )}
          </div>

          {/* Summary column */}
          <div className="lg:sticky lg:top-4 lg:self-start">
            <OrderSummaryPanel items={items} total={totalPrice()} />
          </div>
        </div>
      </div>
    </main>
  )
}
