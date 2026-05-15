import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { getOrderByNumber } from '@/lib/queries'
import { canModifyOrder, formatPrice } from '@/lib/utils'
import { OrderNumberDisplay } from '@/components/checkout/OrderNumberDisplay'

interface Props {
  params:      { numero: string }
  searchParams: { mp?: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `Pedido ${params.numero}`,
    robots: {
      index: false,
      follow: false,
    },
  }
}

const STATUS_LABEL: Record<string, { label: string; color: string; icon: string }> = {
  PENDING:    { label: 'Pendiente',      color: 'text-yellow-700 bg-yellow-50 border-yellow-200', icon: '⏳' },
  CONFIRMED:  { label: 'Confirmado',     color: 'text-blue-700 bg-blue-50 border-blue-200',       icon: '✅' },
  PREPARING:  { label: 'En preparación', color: 'text-purple-700 bg-purple-50 border-purple-200', icon: '📦' },
  DELIVERING: { label: 'En camino',      color: 'text-mk-orange bg-mk-orange-light border-mk-orange/30', icon: '🚚' },
  DELIVERED:  { label: 'Entregado',      color: 'text-mk-green bg-mk-green-pale border-green-200', icon: '🎉' },
  CANCELLED:  { label: 'Cancelado',      color: 'text-red-700 bg-red-50 border-red-200',          icon: '❌' },
}

export default async function OrderPage({ params, searchParams }: Props) {
  const order = await getOrderByNumber(params.numero)
  if (!order) notFound()

  const mpState    = searchParams.mp
  const canModify  = canModifyOrder(order.canModifyUntil)
  const statusInfo = STATUS_LABEL[order.status] ?? STATUS_LABEL.PENDING

  return (
    <main className="min-h-screen bg-mk-light py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* MP feedback banner */}
        {mpState === 'success' && (
          <div className="mb-6 bg-mk-green-pale border border-green-200 rounded-card p-4 text-center">
            <p className="text-mk-green font-bold text-lg">¡Pago recibido! 🎉</p>
            <p className="text-sm text-mk-mid mt-1">Tu pedido está confirmado. Pronto te contactamos.</p>
          </div>
        )}
        {mpState === 'pending' && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-card p-4 text-center">
            <p className="text-yellow-700 font-bold text-lg">Pago pendiente ⏳</p>
            <p className="text-sm text-mk-mid mt-1">MercadoPago está procesando tu pago. Actualizaremos tu pedido en breve.</p>
          </div>
        )}

        {/* Order number */}
        <OrderNumberDisplay orderNumber={order.orderNumber} />

        {/* Status */}
        <div className={`mt-4 flex items-center gap-2 px-4 py-3 rounded-card border ${statusInfo.color}`}>
          <span className="text-2xl">{statusInfo.icon}</span>
          <div>
            <p className="font-bold">{statusInfo.label}</p>
            {order.paymentMethod === 'CASH_ON_DELIVERY' && (
              <p className="text-xs opacity-80">Pagarás al recibir tu pedido</p>
            )}
          </div>
        </div>

        {/* Customer info */}
        <div className="mt-4 bg-white rounded-card shadow-card p-5">
          <h2 className="font-bold text-mk-dark mb-3">Datos de entrega</h2>
          <dl className="space-y-2 text-sm">
            {[
              { label: 'Nombre',    value: order.customerName },
              { label: 'Dirección', value: order.address },
              { label: 'Teléfono',  value: order.phone },
              ...(order.notes ? [{ label: 'Notas', value: order.notes }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-2">
                <dt className="text-mk-mid font-medium min-w-[80px]">{label}:</dt>
                <dd className="text-mk-dark">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Items */}
        <div className="mt-4 bg-white rounded-card shadow-card p-5">
          <h2 className="font-bold text-mk-dark mb-3">Productos</h2>
          <ul className="space-y-3">
            {order.items.map(item => (
              <li key={item.id} className="flex gap-3 items-start">
                <div className="relative w-14 h-14 rounded-chip overflow-hidden bg-mk-light flex-shrink-0">
                  {item.product.images?.[0] ? (
                    <Image
                      src={item.product.images[0]}
                      alt={item.product.name}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  ) : (
                    <span className="flex items-center justify-center w-full h-full text-xl">🐾</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/producto/${item.product.slug}`}
                    className="font-semibold text-sm text-mk-dark hover:text-mk-orange transition-colors line-clamp-2"
                  >
                    {item.product.name}
                  </Link>
                  {item.variantLabel && (
                    <p className="text-xs text-mk-mid">{item.variantLabel}</p>
                  )}
                  <p className="text-xs text-mk-mid">x{item.quantity}</p>
                </div>
                <p className="font-bold text-sm text-mk-dark flex-shrink-0">
                  ${formatPrice(item.unitPrice * item.quantity)}
                </p>
              </li>
            ))}
          </ul>

          <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between">
            <span className="font-semibold text-mk-dark">Total</span>
            <span className="font-bold text-xl text-mk-orange">${formatPrice(order.total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3">
          {canModify && !['PREPARING', 'DELIVERING', 'DELIVERED', 'CANCELLED'].includes(order.status) && (
            <Link
              href={`/pedido/${order.orderNumber}/modificar`}
              className="btn-secondary text-center"
            >
              ✏️ Modificar pedido
            </Link>
          )}
          <Link href="/" className="btn-ghost text-center">
            Seguir comprando 🐾
          </Link>
        </div>

        {canModify && (
          <p className="text-center text-xs text-mk-mid mt-3">
            Podés modificar tu pedido hasta las{' '}
            {new Date(order.canModifyUntil).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </main>
  )
}
