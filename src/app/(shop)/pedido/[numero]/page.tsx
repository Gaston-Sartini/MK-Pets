import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { getOrderByNumber } from '@/lib/queries'
import { canModifyOrder, formatPrice } from '@/lib/utils'
import { OrderNumberDisplay } from '@/components/checkout/OrderNumberDisplay'
import { PayWithMpButton } from '@/components/checkout/PayWithMpButton'
import { CopyText } from '@/components/checkout/CopyText'
import { syncMpPayment } from '@/lib/mp-payments'
import { SHOP_TIMEZONE, whatsappLink } from '@/lib/shop'

interface Props {
  params:      { numero: string }
  searchParams: { mp?: string; payment_id?: string }
}

// Siempre el estado real del pedido: nunca una versión cacheada.
export const dynamic = 'force-dynamic'

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
  SHIPPED:    { label: 'En camino',      color: 'text-mk-orange bg-mk-orange-light border-mk-orange/30', icon: '🚚' },
  DELIVERED:  { label: 'Entregado',      color: 'text-mk-green bg-mk-green-pale border-green-200', icon: '🎉' },
  CANCELLED:  { label: 'Cancelado',      color: 'text-red-700 bg-red-50 border-red-200',          icon: '❌' },
}

export default async function OrderPage({ params, searchParams }: Props) {
  // Al volver de MercadoPago sincronizamos el pago contra su API en el momento,
  // sin depender de que el webhook ya haya llegado.
  if (searchParams.mp && searchParams.payment_id) {
    await syncMpPayment(searchParams.payment_id).catch(() => null)
  }

  const order = await getOrderByNumber(params.numero)
  if (!order) notFound()

  const isMp       = order.paymentMethod === 'MERCADOPAGO'
  const isPaid     = order.paymentStatus === 'APPROVED'
  const isOpen     = !['CANCELLED', 'DELIVERED'].includes(order.status)
  const awaitingMp = isMp && !isPaid && isOpen
  const awaitingTransfer = order.paymentMethod === 'TRANSFER' && !isPaid && isOpen
  const transferAlias    = process.env.TRANSFER_ALIAS
  const transferHolder   = process.env.TRANSFER_HOLDER
  // El banner sale del estado real del pago, no del parámetro de la URL
  // (que cualquiera puede escribir a mano).
  const mpState    = !searchParams.mp ? null
    : isPaid ? 'success'
    : searchParams.mp === 'success' || searchParams.mp === 'pending' ? 'pending'
    : 'error'
  const canModify  = canModifyOrder(order.canModifyUntil) && !isPaid
    && ['PENDING', 'CONFIRMED'].includes(order.status)
  const statusInfo = awaitingMp || awaitingTransfer
    ? { label: 'Esperando el pago', color: 'text-yellow-700 bg-yellow-50 border-yellow-200', icon: '⏳' }
    : STATUS_LABEL[order.status] ?? STATUS_LABEL.PENDING

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
        {mpState === 'error' && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-card p-4 text-center">
            <p className="text-red-700 font-bold text-lg">No se completó el pago</p>
            <p className="text-sm text-mk-mid mt-1">Tu pedido quedó guardado. Podés reintentar el pago acá abajo.</p>
          </div>
        )}

        {/* Order number */}
        <OrderNumberDisplay orderNumber={order.orderNumber} />

        {/* Status */}
        <div className={`mt-4 flex items-center gap-2 px-4 py-3 rounded-card border ${statusInfo.color}`}>
          <span className="text-2xl">{statusInfo.icon}</span>
          <div>
            <p className="font-bold">{statusInfo.label}</p>
            {order.paymentMethod === 'CASH_ON_DELIVERY' && isOpen && (
              <p className="text-xs opacity-80">Pagás en efectivo cuando te entregamos el pedido</p>
            )}
            {awaitingMp && (
              <p className="text-xs opacity-80">Reservamos tus productos por 90 minutos</p>
            )}
            {awaitingTransfer && (
              <p className="text-xs opacity-80">Lo confirmamos apenas recibimos tu transferencia</p>
            )}
            {order.paymentMethod === 'TRANSFER' && isPaid && isOpen && (
              <p className="text-xs opacity-80">Recibimos tu transferencia ✓</p>
            )}
          </div>
        </div>

        {/* Datos para transferir */}
        {awaitingTransfer && (
          <div className="mt-4 bg-white rounded-card shadow-card p-5 border-2 border-mk-orange/40">
            <h2 className="font-bold text-mk-dark mb-3">🏦 Cómo pagar</h2>
            <ol className="space-y-3 text-sm text-mk-dark list-decimal list-inside">
              <li>
                Transferí <strong className="text-mk-orange">{formatPrice(order.total)}</strong>
                {transferAlias
                  ? <> al alias <CopyText value={transferAlias} label="alias" />{transferHolder && <span className="text-mk-mid"> (a nombre de {transferHolder})</span>}</>
                  : <>. Escribinos por WhatsApp y te pasamos los datos.</>}
              </li>
              <li>Mandanos el comprobante por WhatsApp con el botón de abajo.</li>
              <li>Cuando lo vemos, confirmamos tu pedido y coordinamos la entrega.</li>
            </ol>
            <a
              href={whatsappLink(`Hola! Te mando el comprobante de la transferencia del pedido ${order.orderNumber} (${formatPrice(order.total)}).`)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full mt-4 text-center block"
            >
              💬 Enviar comprobante por WhatsApp
            </a>
          </div>
        )}

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
                  {formatPrice(item.unitPrice * item.quantity)}
                </p>
              </li>
            ))}
          </ul>

          <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between">
            <span className="font-semibold text-mk-dark">Total</span>
            <span className="font-bold text-xl text-mk-orange">{formatPrice(order.total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3">
          {awaitingMp && <PayWithMpButton orderNumber={order.orderNumber} />}
          {isOpen && (
            <a
              href={whatsappLink(`Hola! Hice el pedido ${order.orderNumber} en la web.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-center"
            >
              💬 Escribinos por WhatsApp
            </a>
          )}
          {canModify && (
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
            {order.canModifyUntil.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: SHOP_TIMEZONE })}
          </p>
        )}
      </div>
    </main>
  )
}
