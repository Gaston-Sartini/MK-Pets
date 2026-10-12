import { z } from 'zod'
import { BARRIOS_CABA } from '@/lib/barrios'

/**
 * Acepta un celular o fijo argentino escrito como lo escribe la gente:
 * "11 2345 6789", "011 15 2345-6789", "+54 9 11 2345-6789", "(11) 2345 6789".
 * Lo que importa es que, sacando prefijos, queden código de área + número (10 dígitos).
 */
export function isArgPhone(value: string): boolean {
  if (!/^[\d\s()+.\-]+$/.test(value)) return false
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('54')) digits = digits.slice(2)
  if (digits.startsWith('9') && digits.length === 11) digits = digits.slice(1)
  if (digits.startsWith('0')) digits = digits.slice(1)
  // "11 15 2345 6789": el 15 después del código de área sobra
  for (const area of [2, 3, 4]) {
    if (digits.length === 12 && digits.slice(area, area + 2) === '15') { digits = digits.slice(0, area) + digits.slice(area + 2); break }
  }
  return digits.length === 10
}

export const deliveryFormSchema = z.object({
  customerName: z
    .string()
    .min(3,   'El nombre debe tener al menos 3 caracteres')
    .max(100, 'El nombre es demasiado largo'),

  address: z
    .string()
    .min(5,   'Ingresá una dirección completa con calle y número')
    .regex(/\d/, 'Falta el número de la calle')
    .max(150, 'La dirección es demasiado larga'),

  // Solo se entrega en CABA: elegir el barrio evita pedidos desde otra zona
  neighborhood: z
    .string()
    .refine(v => (BARRIOS_CABA as readonly string[]).includes(v), 'Elegí tu barrio. Por ahora entregamos solo en CABA'),

  phone: z
    .string()
    .refine(isArgPhone, 'Ingresá un teléfono válido con código de área (ej: 11 2345 6789)')
    .transform(v => v.replace(/\D/g, '')),

  notes: z
    .string()
    .max(500, 'La nota no puede superar los 500 caracteres')
    .optional(),
})

export type DeliveryFormData = z.infer<typeof deliveryFormSchema>

export const createOrderSchema = z.object({
  paymentMethod: z.enum(['TRANSFER', 'CASH_ON_DELIVERY', 'MERCADOPAGO']),
  customerName:  z.string().min(3).max(100),
  address:       z.string().min(10).max(200),
  phone:         z.string().min(8).max(20),
  notes:         z.string().max(500).optional(),
  items: z.array(z.object({
    productId:    z.string().cuid(),
    variantLabel: z.string().optional(),
    quantity:     z.number().int().positive().max(100),
    unitPrice:    z.number().positive().max(9_999_999),
  })).min(1).max(50),
})

export const modifyOrderSchema = z.object({
  items: z.array(z.object({
    id:       z.string().cuid(),   // OrderItem.id — validated server-side as belonging to the order
    quantity: z.number().int().min(0).max(100),
  })).min(1).max(50),
})
