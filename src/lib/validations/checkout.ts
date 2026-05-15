import { z } from 'zod'

export const deliveryFormSchema = z.object({
  customerName: z
    .string()
    .min(3,   'El nombre debe tener al menos 3 caracteres')
    .max(100, 'El nombre es demasiado largo'),

  address: z
    .string()
    .min(10,  'Ingresá una dirección completa con calle y número')
    .max(200, 'La dirección es demasiado larga'),

  phone: z
    .string()
    .regex(
      /^(\+?54)?[\s-]?(11|15|\d{2,4})[\s-]?\d{4}[\s-]?\d{4}$/,
      'Ingresá un teléfono válido (ej: 11 6669 8395)'
    )
    .transform(v => v.replace(/[\s\-\+]/g, '')),

  notes: z
    .string()
    .max(500, 'La nota no puede superar los 500 caracteres')
    .optional(),
})

export type DeliveryFormData = z.infer<typeof deliveryFormSchema>

export const createOrderSchema = z.object({
  paymentMethod: z.enum(['MERCADOPAGO', 'CASH_ON_DELIVERY']),
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
