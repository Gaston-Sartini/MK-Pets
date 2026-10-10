'use client'

import { enabledPaymentMethods, type PaymentMethod } from '@/lib/shop'

interface Props {
  selected: PaymentMethod | null
  onChange:  (method: PaymentMethod) => void
}

const OPTION_INFO: Record<PaymentMethod, { icon: string; title: string; subtitle: string }> = {
  TRANSFER: {
    icon:     '🏦',
    title:    'Transferencia',
    subtitle: 'Te pasamos el alias al confirmar. Mandás el comprobante por WhatsApp.',
  },
  CASH_ON_DELIVERY: {
    icon:     '🤝',
    title:    'Efectivo al recibir',
    subtitle: 'Pagás en efectivo cuando te entregamos el pedido.',
  },
  MERCADOPAGO: {
    icon:     '💳',
    title:    'MercadoPago',
    subtitle: 'Tarjeta, débito o saldo MP — rápido y seguro',
  },
}

export function PaymentSelector({ selected, onChange }: Props) {
  return (
    // WAI-ARIA: use role="radiogroup" for mutually exclusive payment options
    <fieldset className="border-0 p-0 m-0 space-y-3">
      <legend className="font-bold text-lg text-mk-dark mb-3">¿Cómo querés pagar?</legend>

      {enabledPaymentMethods().map(id => {
        const opt      = OPTION_INFO[id]
        const isActive = selected === id
        const inputId  = `payment-${id}`
        return (
          <label
            key={id}
            htmlFor={inputId}
            className={[
              'flex items-center gap-4 p-4 rounded-card border-2 cursor-pointer transition-all',
              isActive
                ? 'border-mk-orange bg-mk-orange-light shadow-card'
                : 'border-gray-200 bg-white hover:border-mk-orange/50',
            ].join(' ')}
          >
            {/* Visually hidden native radio for proper semantics */}
            <input
              type="radio"
              id={inputId}
              name="paymentMethod"
              value={id}
              checked={isActive}
              onChange={() => onChange(id)}
              className="sr-only"
            />

            <span className="text-3xl select-none" aria-hidden="true">{opt.icon}</span>

            <div className="flex-1">
              <p className={['font-bold', isActive ? 'text-mk-orange-dark' : 'text-mk-dark'].join(' ')}>
                {opt.title}
              </p>
              <p className="text-sm text-mk-mid mt-0.5">{opt.subtitle}</p>
            </div>

            {/* Custom radio indicator — aria-hidden, the real input handles semantics */}
            <span
              aria-hidden="true"
              className={[
                'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                isActive ? 'border-mk-orange bg-mk-orange' : 'border-gray-300',
              ].join(' ')}
            >
              {isActive && <span className="w-2 h-2 rounded-full bg-white" />}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
