'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
    >
      <LogOut className="w-5 h-5 shrink-0" />
      Cerrar sesión
    </button>
  )
}
