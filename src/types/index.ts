export type BadgeVariant = 'new' | 'sale' | 'hot'
export type PaymentMethod = 'MERCADOPAGO' | 'CASH_ON_DELIVERY'
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'MODIFIED'
export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED'

export interface ProductVariant {
  id: string
  label: string
  price: number
  stock: number
}

export interface Product {
  id: string
  name: string
  slug: string
  description: string | null
  images: string[]
  basePrice: number
  stock: number
  badge: BadgeVariant | null
  isFeatured: boolean
  category: { id: string; name: string; slug: string; emoji: string | null }
  variants: ProductVariant[]
}

export interface OrderItem {
  id: string
  productId: string
  name: string
  image: string
  variantLabel: string | null
  quantity: number
  unitPrice: number
}

export interface Order {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  customerName: string
  address: string
  phone: string
  notes: string | null
  items: OrderItem[]
  total: number
  canModifyUntil: string
  createdAt: string
}

export interface DeliveryFormData {
  customerName: string
  address: string
  phone: string
  notes?: string
}
