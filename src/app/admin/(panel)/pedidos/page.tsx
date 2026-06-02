'use client'

import { useEffect, useState } from 'react'
import { formatPrice } from '@/lib/utils'

export const dynamic = 'force-dynamic'

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

export default function AdminPedidosPage() {
  const [orders, setOrders]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadOrders() }, [])

  const loadOrders = async () => {
    setLoading(true)
    const res  = await fetch('/api/admin/pedidos-list')
    const data = await res.json()
    setOrders(data)
    setLoading(false)
  }

  const updateStatus = async (orderNumber: string, status: string) => {
    await fetch(`/api/admin/pedidos/${orderNumber}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status }),
    })
    loadOrders()
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-mk-mid">Cargando pedidos...</div>

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-mk-dark mb-6">Pedidos</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-mk-mid">No hay pedidos aún.</td>
              </tr>
            ) : orders.map((o: any) => (
              <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-semibold text-mk-dark">{o.orderNumber}</p>
                  <p className="text-xs text-mk-mid">{o.items?.length ?? 0} producto(s)</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-mk-dark">{o.customerName}</p>
                  <p className="text-xs text-mk-mid">{o.phone}</p>
                </td>
                <td className="px-4 py-3 text-mk-mid">
                  {new Date(o.createdAt).toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric' })}
                  <p className="text-xs">{new Date(o.createdAt).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })}</p>
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
                </td>
                <td className="px-4 py-3">
                  <select
                    value={o.status}
                    onChange={e => updateStatus(o.orderNumber, e.target.value)}
                    className={`text-xs font-medium px-2 py-1 rounded-full border-0 outline-none cursor-pointer ${STATUS_COLOR[o.status] ?? 'bg-gray-100 text-gray-700'}`}
                  >
                    {STATUSES.map(s => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
