'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PawPrint } from 'lucide-react'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    console.log('[admin-login] submit start', { email })

    try {
      const res = await fetch('/api/admin/login', {
        method:      'POST',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ email, password }),
      })

      console.log('[admin-login] response status:', res.status)

      if (!res.ok) {
        let msg = 'Error al iniciar sesión'
        try {
          const data = await res.json()
          msg = data.error ?? msg
        } catch {
          // body was not JSON
        }
        console.warn('[admin-login] login failed:', msg)
        setError(msg)
        return
      }

      console.log('[admin-login] login OK, redirecting to /admin')
      router.push('/admin')
      router.refresh()
    } catch (err) {
      console.error('[admin-login] fetch error:', err)
      setError('Error de conexión — abrí DevTools (F12) y revisá la consola')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-mk-light to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mb-4">
            <PawPrint className="w-8 h-8 text-mk-orange" />
          </div>
          <h1 className="font-display font-bold text-2xl text-mk-dark mb-1">
            MK-Pets Admin
          </h1>
          <p className="text-mk-mid text-sm">Ingresá tus credenciales para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-mk-dark mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mk-orange focus:border-transparent"
              placeholder="admin@mkpets.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-mk-dark mb-1.5">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mk-orange focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-mk-orange hover:bg-mk-orange-dark text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-mk-mid">
          <a href="/" className="hover:text-mk-orange transition-colors">← Volver a la tienda</a>
        </p>
      </div>
    </div>
  )
}
