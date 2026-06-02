import Link from 'next/link'
import { LayoutDashboard, Package, ShoppingCart, Tag, Store } from 'lucide-react'
import { LogoutButton } from '@/components/admin/LogoutButton'

const NAV = [
  { href: '/admin',            label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/admin/productos',  label: 'Productos',   icon: Package },
  { href: '/admin/categorias', label: 'Categorías',  icon: Tag },
  { href: '/admin/pedidos',    label: 'Pedidos',     icon: ShoppingCart },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* SIDEBAR */}
      <aside className="w-60 shrink-0 bg-gray-900 min-h-screen flex flex-col">
        <div className="px-6 py-5 border-b border-gray-700">
          <span className="font-display font-bold text-white text-lg">MK-Pets Admin</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors text-sm font-medium"
            >
              <Icon className="w-5 h-5 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-3 pb-4 border-t border-gray-700 pt-4 space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors text-sm"
          >
            <Store className="w-5 h-5 shrink-0" />
            Ver tienda
          </Link>
          <LogoutButton />
        </div>
      </aside>

      {/* CONTENT */}
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
