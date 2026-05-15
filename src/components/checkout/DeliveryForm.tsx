'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { deliveryFormSchema, type DeliveryFormData } from '@/lib/validations/checkout'

interface Props {
  onSubmit:  (data: DeliveryFormData) => void
  isLoading: boolean
  defaultValues?: Partial<DeliveryFormData>
}

export function DeliveryForm({ onSubmit, isLoading, defaultValues }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DeliveryFormData>({
    resolver: zodResolver(deliveryFormSchema),
    defaultValues,
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate aria-label="Formulario de entrega">
      <h2 className="font-bold text-lg text-mk-dark">¿A dónde enviamos tu pedido?</h2>

      {/* Nombre */}
      <div>
        <label htmlFor="customerName" className="block text-sm font-semibold text-mk-dark mb-1">
          Nombre completo <span className="text-mk-error" aria-hidden="true">*</span>
          <span className="sr-only">(requerido)</span>
        </label>
        <input
          id="customerName"
          type="text"
          autoComplete="name"
          placeholder="Tu nombre y apellido"
          aria-describedby={errors.customerName ? 'err-customerName' : undefined}
          aria-invalid={!!errors.customerName}
          className={['input-field', errors.customerName ? 'border-mk-error ring-1 ring-mk-error' : ''].join(' ')}
          {...register('customerName')}
        />
        {errors.customerName && (
          <p id="err-customerName" role="alert" className="mt-1 text-xs text-mk-error">
            {errors.customerName.message}
          </p>
        )}
      </div>

      {/* Dirección */}
      <div>
        <label htmlFor="address" className="block text-sm font-semibold text-mk-dark mb-1">
          Dirección de entrega <span className="text-mk-error" aria-hidden="true">*</span>
          <span className="sr-only">(requerida)</span>
        </label>
        <input
          id="address"
          type="text"
          autoComplete="street-address"
          placeholder="Calle y número, piso/depto, ciudad"
          aria-describedby={errors.address ? 'err-address' : undefined}
          aria-invalid={!!errors.address}
          className={['input-field', errors.address ? 'border-mk-error ring-1 ring-mk-error' : ''].join(' ')}
          {...register('address')}
        />
        {errors.address && (
          <p id="err-address" role="alert" className="mt-1 text-xs text-mk-error">
            {errors.address.message}
          </p>
        )}
      </div>

      {/* Teléfono */}
      <div>
        <label htmlFor="phone" className="block text-sm font-semibold text-mk-dark mb-1">
          Teléfono de contacto <span className="text-mk-error" aria-hidden="true">*</span>
          <span className="sr-only">(requerido)</span>
        </label>
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder="11 6669 8395"
          aria-describedby={errors.phone ? 'err-phone' : 'hint-phone'}
          aria-invalid={!!errors.phone}
          className={['input-field', errors.phone ? 'border-mk-error ring-1 ring-mk-error' : ''].join(' ')}
          {...register('phone')}
        />
        <p id="hint-phone" className="mt-1 text-xs text-mk-mid">
          Ejemplo: 11 6669 8395
        </p>
        {errors.phone && (
          <p id="err-phone" role="alert" className="mt-1 text-xs text-mk-error">
            {errors.phone.message}
          </p>
        )}
      </div>

      {/* Notas */}
      <div>
        <label htmlFor="notes" className="block text-sm font-semibold text-mk-dark mb-1">
          Indicaciones adicionales{' '}
          <span className="font-normal text-mk-mid">(opcional)</span>
        </label>
        <textarea
          id="notes"
          rows={3}
          placeholder="Horario de entrega, referencias del lugar, etc."
          aria-describedby={errors.notes ? 'err-notes' : undefined}
          aria-invalid={!!errors.notes}
          className={['input-field resize-none', errors.notes ? 'border-mk-error ring-1 ring-mk-error' : ''].join(' ')}
          {...register('notes')}
        />
        {errors.notes && (
          <p id="err-notes" role="alert" className="mt-1 text-xs text-mk-error">
            {errors.notes.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="btn-primary w-full mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
        aria-busy={isLoading}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <span aria-live="polite">Confirmando pedido...</span>
          </span>
        ) : (
          'Confirmar pedido 🐾'
        )}
      </button>
    </form>
  )
}
