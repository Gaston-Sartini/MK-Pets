'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { formatPrice, parseDbDate } from '@/lib/utils'
import { PAYMENT_METHOD_LABEL, SHOP_TIMEZONE } from '@/lib/shop'
import { normalizeArgPhone } from '@/lib/phone'

const STATUSES = ['PENDING','CONFIRMED','PREPARING','SHIPPED','DELIVERED','CANCELLED'] as const
const STATUS_LABEL: Record<string, string> = {
  PENDING:   'Pendiente',
  CONFIRMED: 'Confirmado',
  PREPARING: 'Preparando',
  SHIPPED:   'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
  MODIFIED:  'Modificado',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING:   'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PREPARING: 'bg-purple-100 text-purple-800',
  SHIPPED:   'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  MODIFIED:  'bg-gray-100 text-gray-700',
}
const PAYMENT_LABEL: Record<string, string> = {
  PENDING:  'Pendiente',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  REFUNDED: 'Reembolsado',
}
const METHOD_LABEL: Record<string, string> = PAYMENT_METHOD_LABEL

interface AdminOrder {
  id: string
  orderNumber: string
  customerName: string
  phone: string
  address: string
  notes: string | null
  total: number
  status: string
  paymentMethod: string
  paymentStatus: string
  createdAt: string
  items: { id: string; quantity: number; unitPrice: number; variantLabel: string | null; product: { name: string } | null }[]
}

type Filter = 'active' | 'all' | (typeof STATUSES)[number]

export default function AdminPedidosPage() {
  const [orders, setOrders]     = useState<AdminOrder[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [filter, setFilter]     = useState<Filter>('active')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving]     = useState<string | null>(null)
  const [notice, setNotice]     = useState('')

  const loadOrders = useCallback(async () => {
    try {
      const res  = await fetch('/api/admin/pedidos-list', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudieron cargar los pedidos')
      setOrders(data)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los pedidos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadOrders() }, [loadOrders])

  const updateStatus = async (order: AdminOrder, status: string) => {
    if (status === order.status) return
    if (status === 'CANCELLED' && !confirm(
      `¿Cancelar el pedido ${order.orderNumber}? Se devuelve el stock y no se puede deshacer.`
    )) return

    await save(order, { status })
  }

  const updatePayment = async (order: AdminOrder, paymentStatus: 'APPROVED' | 'PENDING') => {
    if (paymentStatus === 'PENDING' && !confirm(`¿Marcar el pago del pedido ${order.orderNumber} como NO recibido?`)) return
    await save(order, { paymentStatus })
  }

  const save = async (order: AdminOrder, change: { status?: string; paymentStatus?: string }) => {
    setSaving(order.orderNumber)
    setNotice('')
    try {
      const res  = await fetch(`/api/admin/pedidos/${order.orderNumber}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(change),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'No se pudo guardar el cambio')
      } else {
        setError('')
        if (data.notified) setNotice(`Le avisamos a ${order.customerName} por WhatsApp.`)
      }
    } catch {
      setError('Error de conexión al guardar el cambio')
    } finally {
      setSaving(null)
      loadOrders()
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-mk-mid">Cargando pedidos...</div>

  const visible = orders.filter(o =>
    filter === 'all'    ? true
    : filter === 'active' ? !['DELIVERED', 'CANCELLED'].includes(o.status)
    : o.status === filter
  )

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'active', label: 'En curso' },
    { id: 'all',    label: 'Todos' },
    ...STATUSES.map(s => ({ id: s as Filter, label: STATUS_LABEL[s] })),
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display font-bold text-2xl text-mk-dark">Pedidos</h1>
        <button type="button" onClick={loadOrders} className="text-sm font-medium text-mk-orange hover:text-mk-orange-dark">
          ↻ Actualizar
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {notice && (
        <div role="status" className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">{notice}</div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              filter === f.id
                ? 'bg-mk-orange text-white border-mk-orange'
                : 'bg-white text-gray-600 border-gray-300 hover:border-mk-orange'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Pedido</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Cliente</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Total</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Pago</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-mk-mid">No hay pedidos en esta vista.</td>
              </tr>
            ) : visible.map(o => {
              const created = parseDbDate(o.createdAt)
              const isOpen  = expanded === o.id
              return (
                <Fragment key={o.id}>
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : o.id)}
                        aria-expanded={isOpen}
                        className="text-left"
                      >
                        <p className="font-semibold text-mk-dark">{isOpen ? '▾' : '▸'} {o.orderNumber}</p>
                        <p className="text-xs text-mk-mid">{o.items?.length ?? 0} producto(s) · ver detalle</p>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-mk-dark">{o.customerName}</p>
                      <a
                        href={`https://wa.me/${normalizeArgPhone(o.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-mk-orange hover:underline"
                      >
                        {o.phone}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-mk-mid">
                      {created.toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric', timeZone: SHOP_TIMEZONE })}
                      <p className="text-xs">{created.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', timeZone: SHOP_TIMEZONE })}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-mk-dark">{formatPrice(o.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        o.paymentStatus === 'APPROVED' ? 'bg-green-100 text-green-800'
                        : o.paymentStatus === 'REJECTED' ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {PAYMENT_LABEL[o.paymentStatus] ?? o.paymentStatus}
                      </span>
                      <p className="text-xs text-mk-mid mt-1">{METHOD_LABEL[o.paymentMethod] ?? o.paymentMethod}</p>
                      {/* El pago de MercadoPago lo confirma MP solo; efectivo y transferencia, a mano. */}
                      {o.paymentMethod !== 'MERCADOPAGO' && o.status !== 'CANCELLED' && (
                        <button
                          type="button"
                          disabled={saving === o.orderNumber}
                          onClick={() => updatePayment(o, o.paymentStatus === 'APPROVED' ? 'PENDING' : 'APPROVED')}
                          className="mt-1 text-xs font-semibold text-mk-orange hover:underline disabled:opacity-50"
                        >
                          {o.paymentStatus === 'APPROVED' ? 'Deshacer' : 'Marcar pago recibido'}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={o.status}
                        disabled={saving === o.orderNumber || o.status === 'CANCELLED'}
                        onChange={e => updateStatus(o, e.target.value)}
                        aria-label={`Estado del pedido ${o.orderNumber}`}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 ${STATUS_COLOR[o.status] ?? 'bg-gray-100 text-gray-700'}`}
                      >
                        {STATUSES.map(s => (
                          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Entrega</p>
                            <p className="text-mk-dark">{o.address}</p>
                            {o.notes && <p className="text-mk-mid mt-1 italic">“{o.notes}”</p>}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Productos</p>
                            <ul className="space-y-1">
                              {o.items.map(i => (
                                <li key={i.id} className="flex justify-between gap-4 text-mk-dark">
                                  <span>
                                    {i.quantity} × {i.product?.name ?? 'Producto'}
                                    {i.variantLabel ? ` (${i.variantLabel})` : ''}
                                  </span>
                                  <span className="font-medium">{formatPrice(i.unitPrice * i.quantity)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
