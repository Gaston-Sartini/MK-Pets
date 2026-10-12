/**
 * Recorrido del pedido: dónde está y qué falta. Evita el "¿en qué anda mi pedido?".
 * No guarda horarios de cada paso (la base solo tiene el estado actual).
 */

const STEPS = [
  { key: 'PENDING',   label: 'Recibido',    icon: '📝' },
  { key: 'CONFIRMED', label: 'Confirmado',  icon: '✅' },
  { key: 'PREPARING', label: 'Preparando',  icon: '📦' },
  { key: 'SHIPPED',   label: 'En camino',   icon: '🚚' },
  { key: 'DELIVERED', label: 'Entregado',   icon: '🎉' },
] as const

export function OrderTimeline({ status }: { status: string }) {
  const current = STEPS.findIndex(s => s.key === status)
  // Un pedido cancelado (o un estado desconocido) no tiene recorrido que mostrar
  if (current === -1) return null

  return (
    <ol className="mt-4 bg-white rounded-card shadow-card p-4 flex items-start justify-between gap-1" aria-label="Recorrido del pedido">
      {STEPS.map((step, i) => {
        const done   = i < current
        const active = i === current
        return (
          <li key={step.key} className="flex-1 flex flex-col items-center text-center min-w-0" aria-current={active ? 'step' : undefined}>
            <div className="flex items-center w-full">
              <span className={`h-0.5 flex-1 ${i === 0 ? 'invisible' : done || active ? 'bg-mk-green' : 'bg-gray-200'}`} />
              <span
                className={[
                  'w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-base border-2',
                  active ? 'border-mk-orange bg-mk-orange-light' : done ? 'border-mk-green bg-mk-green-pale' : 'border-gray-200 bg-gray-50 opacity-50',
                ].join(' ')}
                aria-hidden="true"
              >
                {step.icon}
              </span>
              <span className={`h-0.5 flex-1 ${i === STEPS.length - 1 ? 'invisible' : done ? 'bg-mk-green' : 'bg-gray-200'}`} />
            </div>
            <span className={`mt-1.5 text-[11px] leading-tight ${active ? 'font-bold text-mk-dark' : done ? 'text-mk-dark' : 'text-mk-mid'}`}>
              {step.label}
              <span className="sr-only">{done ? ' (listo)' : active ? ' (ahora)' : ' (falta)'}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
