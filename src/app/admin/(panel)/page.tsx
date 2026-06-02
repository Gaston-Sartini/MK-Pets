import { supabase } from '@/lib/supabase'
import { Package, ShoppingCart, Tag, AlertTriangle } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

export const dynamic = 'force-dynamic'

async function getStats() {
  const [
    { count: totalProducts },
    { count: activeProducts },
    { count: pendingOrders },
    { data: lowStock },
    { data: recentOrders },
  ] = await Promise.all([
    supabase.from('Product').select('*', { count: 'exact', head: true }),
    supabase.from('Product').select('*', { count: 'exact', head: true }).eq('isActive', true),
    supabase.from('Order').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
    supabase.from('Product').select('id, name, stock').eq('isActive', true).lte('stock', 5).order('stock').limit(5),
    supabase.from('Order')
      .select('orderNumber, customerName, total, status, createdAt')
      .order('createdAt', { ascending: false })
      .limit(6),
  ])

  return { totalProducts, activeProducts, pendingOrders, lowStock: lowStock ?? [], recentOrders: recentOrders ?? [] }
}

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

export default async function AdminDashboard() {
  const { totalProducts, activeProducts, pendingOrders, lowStock, recentOrders } = await getStats()

  const stats = [
    { label: 'Productos totales',  value: totalProducts  ?? 0, icon: Package,      color: 'bg-orange-100 text-mk-orange' },
    { label: 'Productos activos',  value: activeProducts ?? 0, icon: Package,      color: 'bg-green-100 text-green-700' },
    { label: 'Pedidos pendientes', value: pendingOrders  ?? 0, icon: ShoppingCart, color: 'bg-blue-100 text-blue-700' },
    { label: 'Stock bajo (≤5)',    value: lowStock.length,      icon: AlertTriangle, color: 'bg-red-100 text-red-700' },
  ]

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-mk-dark mb-6">Dashboard</h1>

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-mk-dark">{s.value}</p>
            <p className="text-sm text-mk-mid mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* RECENT ORDERS */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-display font-bold text-base text-mk-dark mb-4">Pedidos recientes</h2>
          {recentOrders.length === 0 ? (
            <p className="text-mk-mid text-sm">No hay pedidos aún.</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((o: any) => (
                <div key={o.orderNumber} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-mk-dark">{o.orderNumber}</p>
                    <p className="text-xs text-mk-mid">{o.customerName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[o.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                    <span className="text-sm font-bold text-mk-dark">{formatPrice(o.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* LOW STOCK */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-display font-bold text-base text-mk-dark mb-4">Stock bajo</h2>
          {lowStock.length === 0 ? (
            <p className="text-mk-mid text-sm">Todos los productos tienen stock suficiente.</p>
          ) : (
            <div className="space-y-3">
              {lowStock.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <p className="text-sm text-mk-dark line-clamp-1">{p.name}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {p.stock === 0 ? 'Sin stock' : `${p.stock} ud.`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
