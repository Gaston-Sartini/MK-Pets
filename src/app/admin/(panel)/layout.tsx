import Link from 'next/link'
import { LayoutDashboard, Package, Percent, ShoppingCart, Tag, Store, UserCog } from 'lucide-react'
import { LogoutButton } from '@/components/admin/LogoutButton'

const NAV = [
  { href: '/admin',            label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/admin/pedidos',    label: 'Pedidos',     icon: ShoppingCart },
  { href: '/admin/productos',  label: 'Productos',   icon: Package },
  { href: '/admin/precios',    label: 'Precios',     icon: Percent },
  { href: '/admin/categorias', label: 'Categorías',  icon: Tag },
  { href: '/admin/cuenta',     label: 'Mi cuenta',   icon: UserCog },
]

const linkClass =
  'flex items-center gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white ' +
  'transition-colors text-sm font-medium whitespace-nowrap'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    // En celular el menú va arriba, en una fila que se desliza; desde md es la barra lateral.
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      <aside className="md:w-60 shrink-0 bg-gray-900 md:min-h-screen flex flex-col">
        <div className="px-4 md:px-6 py-3 md:py-5 border-b border-gray-700">
          <span className="font-display font-bold text-white text-lg">MK-Pets Admin</span>
        </div>

        <nav aria-label="Panel" className="flex md:flex-col md:flex-1 gap-1 px-2 md:px-3 py-2 md:py-4 overflow-x-auto">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={linkClass}>
              <Icon className="w-5 h-5 shrink-0" />
              {label}
            </Link>
          ))}
          <Link href="/" className={`${linkClass} md:hidden`}>
            <Store className="w-5 h-5 shrink-0" />
            Ver tienda
          </Link>
          <div className="md:hidden shrink-0"><LogoutButton /></div>
        </nav>

        <div className="hidden md:block px-3 pb-4 border-t border-gray-700 pt-4 space-y-1">
          <Link href="/" className={linkClass}>
            <Store className="w-5 h-5 shrink-0" />
            Ver tienda
          </Link>
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
