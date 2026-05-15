'use client'

interface Props {
  currentStep: 1 | 2
}

export function StepIndicator({ currentStep }: Props) {
  const steps = [
    { n: 1, label: 'Método de pago' },
    { n: 2, label: 'Datos de entrega' },
  ]

  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((step, i) => {
        const done    = currentStep > step.n
        const active  = currentStep === step.n

        return (
          <div key={step.n} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={[
                  'w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors',
                  done   ? 'bg-mk-green text-white' : '',
                  active ? 'bg-mk-orange text-white' : '',
                  !done && !active ? 'bg-mk-light text-mk-mid border border-gray-300' : '',
                ].join(' ')}
              >
                {done ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.n
                )}
              </div>
              <span
                className={[
                  'mt-1 text-xs font-medium whitespace-nowrap',
                  active ? 'text-mk-orange' : done ? 'text-mk-green' : 'text-mk-mid',
                ].join(' ')}
              >
                {step.label}
              </span>
            </div>

            {i < steps.length - 1 && (
              <div
                className={[
                  'h-0.5 flex-1 mx-2 mb-5 transition-colors',
                  done ? 'bg-mk-green' : 'bg-gray-200',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
