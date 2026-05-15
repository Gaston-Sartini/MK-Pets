'use client'

type PaymentMethod = 'MERCADOPAGO' | 'CASH_ON_DELIVERY'

interface Props {
  selected: PaymentMethod | null
  onChange:  (method: PaymentMethod) => void
}

const OPTIONS: { id: PaymentMethod; icon: string; title: string; subtitle: string }[] = [
  {
    id:       'MERCADOPAGO',
    icon:     '💳',
    title:    'MercadoPago',
    subtitle: 'Tarjeta, débito o saldo MP — rápido y seguro',
  },
  {
    id:       'CASH_ON_DELIVERY',
    icon:     '🤝',
    title:    'Pagar al recibir',
    subtitle: 'Efectivo o transferencia cuando llega tu pedido',
  },
]

export function PaymentSelector({ selected, onChange }: Props) {
  return (
    // WAI-ARIA: use role="radiogroup" for mutually exclusive payment options
    <fieldset className="border-0 p-0 m-0 space-y-3">
      <legend className="font-bold text-lg text-mk-dark mb-3">¿Cómo querés pagar?</legend>

      {OPTIONS.map(opt => {
        const isActive = selected === opt.id
        const inputId  = `payment-${opt.id}`
        return (
          <label
            key={opt.id}
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
              value={opt.id}
              checked={isActive}
              onChange={() => onChange(opt.id)}
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
