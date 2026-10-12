'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { deliveryFormSchema, type DeliveryFormData } from '@/lib/validations/checkout'
import { BARRIOS_CABA } from '@/lib/barrios'

// Datos de entrega guardados en este dispositivo, para no escribirlos en cada compra
const STORAGE_KEY = 'mkpets-customer'
type Remembered = Pick<DeliveryFormData, 'customerName' | 'address' | 'neighborhood'> & { phone: string }

function loadRemembered(): Partial<Remembered> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

interface Props {
  onSubmit:  (data: DeliveryFormData) => void
  isLoading: boolean
  defaultValues?: Partial<DeliveryFormData>
}

export function DeliveryForm({ onSubmit, isLoading, defaultValues }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
  } = useForm<DeliveryFormData>({
    resolver: zodResolver(deliveryFormSchema),
    defaultValues: { neighborhood: '', ...defaultValues },
  })

  const [remember, setRemember] = useState(true)

  // Se cargan después del primer render (localStorage no existe en el servidor)
  useEffect(() => {
    const saved = loadRemembered()
    if (saved) reset({ ...getValues(), ...saved })
  }, [reset, getValues])

  function submit(data: DeliveryFormData) {
    try {
      if (remember) {
        const toSave: Remembered = {
          customerName: data.customerName, address: data.address, neighborhood: data.neighborhood,
          // El teléfono tal como lo escribió, no el normalizado
          phone: getValues('phone'),
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {}
    onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate aria-label="Formulario de entrega">
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
          placeholder="Calle y número, piso y depto"
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

      {/* Barrio */}
      <div>
        <label htmlFor="neighborhood" className="block text-sm font-semibold text-mk-dark mb-1">
          Barrio <span className="text-mk-error" aria-hidden="true">*</span>
          <span className="sr-only">(requerido)</span>
        </label>
        <select
          id="neighborhood"
          autoComplete="address-level2"
          aria-describedby={errors.neighborhood ? 'err-neighborhood' : 'hint-neighborhood'}
          aria-invalid={!!errors.neighborhood}
          className={['input-field', errors.neighborhood ? 'border-mk-error ring-1 ring-mk-error' : ''].join(' ')}
          {...register('neighborhood')}
        >
          <option value="">Elegí tu barrio</option>
          {BARRIOS_CABA.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <p id="hint-neighborhood" className="mt-1 text-xs text-mk-mid">
          Entregamos en la Ciudad de Buenos Aires. ¿Estás en otra zona? Escribinos por WhatsApp.
        </p>
        {errors.neighborhood && (
          <p id="err-neighborhood" role="alert" className="mt-1 text-xs text-mk-error">
            {errors.neighborhood.message}
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
          placeholder="11 2345 6789"
          aria-describedby={errors.phone ? 'err-phone' : 'hint-phone'}
          aria-invalid={!!errors.phone}
          className={['input-field', errors.phone ? 'border-mk-error ring-1 ring-mk-error' : ''].join(' ')}
          {...register('phone')}
        />
        <p id="hint-phone" className="mt-1 text-xs text-mk-mid">
          Con código de área. Ejemplo: 11 2345 6789
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

      <label className="flex items-center gap-2 text-sm text-mk-mid cursor-pointer select-none">
        <input
          type="checkbox"
          checked={remember}
          onChange={e => setRemember(e.target.checked)}
          className="w-4 h-4 accent-mk-orange"
        />
        Recordar mis datos en este dispositivo para la próxima compra
      </label>

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
