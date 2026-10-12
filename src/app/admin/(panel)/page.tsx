import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAdminClient } from '@/lib/admin-auth'
import { Package, ShoppingCart, AlertTriangle, Clock } from 'lucide-react'
import { formatPrice, parseDbDate } from '@/lib/utils'
import { SHOP_TIMEZONE } from '@/lib/shop'
import { summarizeSales, type SaleOrder } from '@/lib/sales'

export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000

async function getStats(supabase: SupabaseClient) {
  const monthAgo = new Date(Date.now() - 31 * DAY_MS).toISOString()
  const weekAgo  = new Date(Date.now() - 7 * DAY_MS).toLocaleDateString('en-CA', { timeZone: SHOP_TIMEZONE })

  const [
    { count: activeProducts },
    { count: pendingOrders },
    { data: stockRows },
    { data: recentOrders },
    { data: monthOrders },
    { data: unpaid },
    { data: views },
  ] = await Promise.all([
    supabase.from('Product').select('*', { count: 'exact', head: true }).eq('isActive', true),
    supabase.from('Order').select('*', { count: 'exact', head: true }).in('status', ['PENDING', 'CONFIRMED']),
    supabase.from('Product').select('id, name, stock, variants:ProductVariant(label, stock)').eq('isActive', true),
    supabase.from('Order')
      .select('orderNumber, customerName, total, status, createdAt')
      .order('createdAt', { ascending: false })
      .limit(6),
    supabase.from('Order')
      .select('status, total, createdAt, items:OrderItem(quantity, unitPrice, variantLabel, product:Product(name))')
      .gte('createdAt', monthAgo)
      .limit(2000),
    supabase.from('Order')
      .select('orderNumber, createdAt')
      .eq('paymentMethod', 'TRANSFER').eq('paymentStatus', 'PENDING').in('status', ['PENDING', 'CONFIRMED']),
    supabase.from('PageView').select('day, path, views').gte('day', weekAgo),
  ])

  // Un producto con variantes se vende por variante: lo que importa es el stock de cada una.
  const lowStock = ((stockRows ?? []) as { id: string; name: string; stock: number; variants: { label: string; stock: number }[] }[])
    .flatMap(p => (p.variants.length
      ? p.variants.map(v => ({ id: `${p.id}:${v.label}`, name: `${p.name} (${v.label})`, stock: v.stock }))
      : [{ id: p.id, name: p.name, stock: p.stock }]))
    .filter(p => p.stock <= 5)
    .sort((a, b) => a.stock - b.stock)

  const sales = summarizeSales(
    ((monthOrders ?? []) as any[]).map((o): SaleOrder => ({
      status: o.status,
      total: Number(o.total),
      createdAt: parseDbDate(o.createdAt),
      items: (o.items ?? []).map((i: any) => ({
        name: i.product?.name ?? 'Producto', variantLabel: i.variantLabel, quantity: i.quantity, unitPrice: Number(i.unitPrice),
      })),
    })),
    new Date(),
    SHOP_TIMEZONE,
  )

  // Transferencias que esperan el pago hace más de un día: retienen stock hasta que alguien decide
  const overdue = ((unpaid ?? []) as { orderNumber: string; createdAt: string }[])
    .filter(o => Date.now() - parseDbDate(o.createdAt).getTime() > DAY_MS).length

  const viewRows = (views ?? []) as { day: string; path: string; views: number }[]
  const today    = new Date().toLocaleDateString('en-CA', { timeZone: SHOP_TIMEZONE })
  const byPath   = new Map<string, number>()
  for (const v of viewRows) byPath.set(v.path, (byPath.get(v.path) ?? 0) + v.views)

  return {
    activeProducts, pendingOrders, lowStock, recentOrders: recentOrders ?? [], sales, overdue,
    visits: {
      today: viewRows.filter(v => v.day === today).reduce((s, v) => s + v.views, 0),
      week:  viewRows.reduce((s, v) => s + v.views, 0),
      top:   [...byPath.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    },
  }
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

const PAGE_NAME: Record<string, string> = {
  '/': 'Portada', '/productos': 'Catálogo', '/checkout': 'Checkout', '/pedido': 'Página de un pedido', '/seguimiento': 'Seguí tu pedido',
}
const pageName = (path: string) =>
  PAGE_NAME[path] ?? (path.startsWith('/producto/') ? `Ficha: ${path.slice('/producto/'.length)}` : path)

export default async function AdminDashboard() {
  // RLS solo deja ver productos inactivos y pedidos con la sesión del admin
  const supabase = await getAdminClient()
  if (!supabase) redirect('/admin/login')

  const { activeProducts, pendingOrders, lowStock, recentOrders, sales, overdue, visits } = await getStats(supabase)

  const windows = [
    { label: 'Hoy',             ...sales.today },
    { label: 'Últimos 7 días',  ...sales.week },
    { label: 'Últimos 30 días', ...sales.month },
  ]

  const stats = [
    { label: 'Pedidos por preparar',                value: pendingOrders ?? 0,  icon: ShoppingCart,  color: 'bg-blue-100 text-blue-700',   href: '/admin/pedidos' },
    { label: 'Transferencias sin pagar hace +24 h', value: overdue,             icon: Clock,         color: 'bg-amber-100 text-amber-700', href: '/admin/pedidos' },
    { label: 'Con poco stock (5 o menos)',          value: lowStock.length,     icon: AlertTriangle, color: 'bg-red-100 text-red-700',     href: '/admin/productos' },
    { label: 'Productos activos',                   value: activeProducts ?? 0, icon: Package,       color: 'bg-green-100 text-green-700', href: '/admin/productos' },
  ]

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-mk-dark mb-6">Dashboard</h1>

      {/* VENTAS */}
      <h2 className="font-display font-bold text-sm uppercase tracking-wide text-mk-mid mb-3">Ventas</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
        {windows.map(w => (
          <div key={w.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-mk-mid">{w.label}</p>
            <p className="text-2xl font-bold text-mk-dark mt-1">{formatPrice(w.total)}</p>
            <p className="text-xs text-mk-mid mt-0.5">{w.orders} {w.orders === 1 ? 'pedido' : 'pedidos'}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-mk-mid mb-8">Cuenta todos los pedidos que no están cancelados, estén o no pagos todavía.</p>

      {/* PARA ATENDER */}
      <h2 className="font-display font-bold text-sm uppercase tracking-wide text-mk-mid mb-3">Para atender</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <Link key={s.label} href={s.href} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-mk-orange transition-colors">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-mk-dark">{s.value}</p>
            <p className="text-sm text-mk-mid mt-0.5">{s.label}</p>
          </Link>
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

        {/* TOP PRODUCTS */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-display font-bold text-base text-mk-dark mb-4">Lo más vendido (30 días)</h2>
          {sales.top.length === 0 ? (
            <p className="text-mk-mid text-sm">Todavía no hay ventas en este período.</p>
          ) : (
            <ol className="space-y-3">
              {sales.top.map((p, i) => (
                <li key={p.name} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
                  <p className="text-sm text-mk-dark line-clamp-1"><span className="text-mk-mid mr-2">{i + 1}.</span>{p.name}</p>
                  <span className="text-xs font-bold text-mk-dark whitespace-nowrap">{p.units} u. · {formatPrice(p.total)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* LOW STOCK */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-display font-bold text-base text-mk-dark mb-4">Stock bajo</h2>
          {lowStock.length === 0 ? (
            <p className="text-mk-mid text-sm">Todos los productos tienen stock suficiente.</p>
          ) : (
            <div className="space-y-3">
              {lowStock.slice(0, 8).map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <p className="text-sm text-mk-dark line-clamp-1">{p.name}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {p.stock === 0 ? 'Sin stock' : `${p.stock} ud.`}
                  </span>
                </div>
              ))}
              {lowStock.length > 8 && <p className="text-xs text-mk-mid">…y {lowStock.length - 8} más.</p>}
            </div>
          )}
        </div>

        {/* VISITS */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-display font-bold text-base text-mk-dark mb-1">Visitas</h2>
          <p className="text-sm text-mk-mid mb-4">
            <strong className="text-mk-dark">{visits.today}</strong> páginas vistas hoy ·{' '}
            <strong className="text-mk-dark">{visits.week}</strong> en los últimos 7 días
          </p>
          {visits.top.length === 0 ? (
            <p className="text-mk-mid text-sm">Todavía no hay visitas registradas.</p>
          ) : (
            <ol className="space-y-3">
              {visits.top.map(([path, count]) => (
                <li key={path} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
                  <p className="text-sm text-mk-dark line-clamp-1">{pageName(path)}</p>
                  <span className="text-xs font-bold text-mk-dark">{count}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="text-xs text-mk-mid mt-3">Se cuentan páginas vistas, no personas. Sin cookies ni datos personales.</p>
        </div>
      </div>
    </div>
  )
}
