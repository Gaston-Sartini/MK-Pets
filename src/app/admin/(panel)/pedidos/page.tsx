'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { formatPrice, parseDbDate } from '@/lib/utils'
import { PAYMENT_METHOD_LABEL, SHOP_TIMEZONE } from '@/lib/shop'
import { normalizeArgPhone } from '@/lib/phone'
import { allowedStatuses, transitionKind } from '@/lib/order-status'
import { useConfirm } from '@/components/admin/ConfirmDialog'

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
type Period = 'all' | 'today' | '7d' | '30d'

const PERIODS: { id: Period; label: string; days: number | null }[] = [
  { id: 'all',   label: 'Siempre',  days: null },
  { id: 'today', label: 'Hoy',      days: 0 },
  { id: '7d',    label: '7 días',   days: 7 },
  { id: '30d',   label: '30 días',  days: 30 },
]

const DAY_MS = 24 * 60 * 60 * 1000
const plain  = (text: string) => text.toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]/g, '')

/** Día (en horario de Argentina) de una fecha, para comparar "hoy". */
const dayOf = (date: Date) => date.toLocaleDateString('en-CA', { timeZone: SHOP_TIMEZONE })

/** Hace cuánto espera el pago una transferencia: solo interesa si ya pasó un día. */
function unpaidFor(o: AdminOrder): string | null {
  if (o.paymentMethod !== 'TRANSFER' || o.paymentStatus === 'APPROVED' || ['CANCELLED', 'DELIVERED'].includes(o.status)) return null
  const hours = (Date.now() - parseDbDate(o.createdAt).getTime()) / 3_600_000
  if (hours < 24) return null
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Sin pagar hace 1 día' : `Sin pagar hace ${days} días`
}

function toCsv(orders: AdminOrder[]): string {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const rows = [
    ['Pedido', 'Fecha', 'Cliente', 'Teléfono', 'Dirección', 'Productos', 'Total', 'Medio de pago', 'Pago', 'Estado', 'Notas'],
    ...orders.map(o => [
      o.orderNumber,
      parseDbDate(o.createdAt).toLocaleString('es-AR', { timeZone: SHOP_TIMEZONE }),
      o.customerName,
      o.phone,
      o.address,
      o.items.map(i => `${i.quantity} x ${i.product?.name ?? 'Producto'}${i.variantLabel ? ` (${i.variantLabel})` : ''}`).join(' | '),
      o.total,
      METHOD_LABEL[o.paymentMethod] ?? o.paymentMethod,
      PAYMENT_LABEL[o.paymentStatus] ?? o.paymentStatus,
      STATUS_LABEL[o.status] ?? o.status,
      o.notes ?? '',
    ]),
  ]
  // Punto y coma y marca de inicio: así Excel en español lo abre en columnas y con los acentos bien
  return String.fromCharCode(0xFEFF) + rows.map(r => r.map(cell).join(';')).join('\r\n')
}

export default function AdminPedidosPage() {
  const [orders, setOrders]     = useState<AdminOrder[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [filter, setFilter]     = useState<Filter>('active')
  const [period, setPeriod]     = useState<Period>('all')
  const [search, setSearch]     = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving]     = useState<string | null>(null)
  const [notice, setNotice]     = useState('')
  const [printing, setPrinting] = useState<AdminOrder | null>(null)
  const { confirm, dialog }     = useConfirm()

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

  // La hoja para imprimir se dibuja primero y recién después se abre el diálogo de impresión
  useEffect(() => {
    if (!printing) return
    const done = () => setPrinting(null)
    window.addEventListener('afterprint', done)
    const timer = setTimeout(() => window.print(), 100)
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', done) }
  }, [printing])

  const updateStatus = async (order: AdminOrder, status: string) => {
    const kind = transitionKind(order.status, status)
    if (kind === 'same' || kind === 'invalid') return
    if (kind === 'cancel' && !(await confirm({
      title: `¿Cancelar el pedido ${order.orderNumber}?`,
      detail: 'Se devuelve el stock, se le avisa al cliente y no se puede deshacer.',
      confirmLabel: 'Sí, cancelar el pedido',
      danger: true,
    }))) return

    await save(order, { status })
  }

  const updatePayment = async (order: AdminOrder, paymentStatus: 'APPROVED' | 'PENDING') => {
    if (paymentStatus === 'PENDING' && !(await confirm({
      title: `¿Marcar el pago de ${order.orderNumber} como NO recibido?`,
      detail: 'Usalo solo si lo habías marcado por error.',
      confirmLabel: 'Sí, no se recibió',
    }))) return
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

  const visible = useMemo(() => {
    const words = plain(search).split(' ').filter(Boolean)
    const days  = PERIODS.find(p => p.id === period)?.days ?? null
    const today = dayOf(new Date())
    return orders.filter(o => {
      if (filter === 'active' ? ['DELIVERED', 'CANCELLED'].includes(o.status) : filter !== 'all' && o.status !== filter) return false
      const created = parseDbDate(o.createdAt)
      if (days === 0 && dayOf(created) !== today) return false
      if (days && Date.now() - created.getTime() > days * DAY_MS) return false
      if (words.length === 0) return true
      const haystack = plain(`${o.orderNumber} ${o.customerName} ${o.phone} ${o.address} ${o.items.map(i => i.product?.name ?? '').join(' ')}`)
      return words.every(w => haystack.includes(w))
    })
  }, [orders, filter, period, search])

  const exportCsv = () => {
    const url  = URL.createObjectURL(new Blob([toCsv(visible)], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `pedidos-mk-pets-${dayOf(new Date())}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-mk-mid">Cargando pedidos...</div>

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'active', label: 'En curso' },
    { id: 'all',    label: 'Todos' },
    ...STATUSES.map(s => ({ id: s as Filter, label: STATUS_LABEL[s] })),
  ]
  const totalVisible = visible.filter(o => o.status !== 'CANCELLED').reduce((sum, o) => sum + Number(o.total), 0)

  return (
    <div>
      {dialog}

      {/* Al imprimir se ve solo la hoja del pedido elegido */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #hoja-pedido, #hoja-pedido * { visibility: visible !important; }
          #hoja-pedido { position: absolute; inset: 0; padding: 24px; }
        }
      `}</style>
      {printing && <PrintSheet order={printing} />}

      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display font-bold text-2xl text-mk-dark">Pedidos</h1>
        <div className="flex items-center gap-4">
          <button type="button" onClick={exportCsv} disabled={visible.length === 0} className="text-sm font-medium text-mk-orange hover:text-mk-orange-dark disabled:opacity-40">
            ⬇ Exportar a planilla
          </button>
          <button type="button" onClick={loadOrders} className="text-sm font-medium text-mk-orange hover:text-mk-orange-dark">
            ↻ Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {notice && (
        <div role="status" className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">{notice}</div>
      )}

      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por cliente, teléfono, número, dirección o producto"
          aria-label="Buscar pedidos"
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-mk-orange/40 focus:border-mk-orange"
        />
        <div className="flex gap-1" role="group" aria-label="Período">
          {PERIODS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              aria-pressed={period === p.id}
              className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${
                period === p.id ? 'bg-mk-navy text-white border-mk-navy' : 'bg-white text-gray-600 border-gray-300 hover:border-mk-navy'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
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

      <p className="text-xs text-mk-mid mb-3">
        {visible.length} {visible.length === 1 ? 'pedido' : 'pedidos'} · {formatPrice(totalVisible)} sin contar cancelados
      </p>

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
              const unpaid  = unpaidFor(o)
              return (
                <Fragment key={o.id}>
                  <tr className={`border-b border-gray-100 hover:bg-gray-50 ${unpaid ? 'bg-amber-50/60' : ''}`}>
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
                      {unpaid && <p className="text-xs font-semibold text-amber-700 mt-1">⏰ {unpaid}</p>}
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
                        {/* Solo lo que tiene sentido desde el estado actual: avanzar, volver un paso o cancelar */}
                        {allowedStatuses(o.status).map(s => (
                          <option key={s} value={s}>
                            {transitionKind(o.status, s) === 'back' ? `↩ Volver a ${STATUS_LABEL[s]}` : STATUS_LABEL[s]}
                          </option>
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
                            <button type="button" onClick={() => setPrinting(o)} className="mt-3 text-xs font-semibold text-mk-orange hover:underline">
                              🖨 Imprimir este pedido
                            </button>
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

/** Hoja para armar y repartir: lo que hace falta leer con el pedido en la mano. */
function PrintSheet({ order: o }: { order: AdminOrder }) {
  const created = parseDbDate(o.createdAt)
  return (
    <div id="hoja-pedido" className="fixed inset-0 z-[200] bg-white text-black p-6 overflow-auto print:static">
      <h1 className="text-2xl font-bold">MK-Pets · Pedido {o.orderNumber}</h1>
      <p className="text-sm mt-1">
        {created.toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short', timeZone: SHOP_TIMEZONE })}
      </p>

      <div className="mt-5 text-base leading-relaxed">
        <p><strong>Cliente:</strong> {o.customerName}</p>
        <p><strong>Teléfono:</strong> {o.phone}</p>
        <p><strong>Dirección:</strong> {o.address}</p>
        {o.notes && <p><strong>Notas:</strong> {o.notes}</p>}
        <p>
          <strong>Pago:</strong> {METHOD_LABEL[o.paymentMethod] ?? o.paymentMethod} —{' '}
          {o.paymentStatus === 'APPROVED' ? 'YA PAGADO' : o.paymentMethod === 'CASH_ON_DELIVERY' ? 'COBRAR AL ENTREGAR' : 'PAGO PENDIENTE'}
        </p>
      </div>

      <table className="w-full mt-5 text-base border-collapse">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-1 w-16">Cant.</th>
            <th className="py-1">Producto</th>
            <th className="py-1 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {o.items.map(i => (
            <tr key={i.id} className="border-b border-gray-400">
              <td className="py-1.5 font-bold">{i.quantity}</td>
              <td className="py-1.5">{i.product?.name ?? 'Producto'}{i.variantLabel ? ` (${i.variantLabel})` : ''}</td>
              <td className="py-1.5 text-right">{formatPrice(i.unitPrice * i.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-right text-xl font-bold">Total: {formatPrice(o.total)}</p>
    </div>
  )
}
