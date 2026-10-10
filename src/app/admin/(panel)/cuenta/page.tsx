'use client'

import { useState } from 'react'
import { Eye, EyeOff, KeyRound } from 'lucide-react'

const MIN_LENGTH = 10

export default function AdminCuentaPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [show, setShow]       = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)

  const tooShort = newPassword.length > 0 && newPassword.length < MIN_LENGTH
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword
  const canSave  = currentPassword && newPassword.length >= MIN_LENGTH && confirmPassword === newPassword && !saving

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      const res = await fetch('/api/admin/password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'No se pudo cambiar la contraseña')
        return
      }
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mk-orange focus:border-transparent'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'
  const type = show ? 'text' : 'password'

  return (
    <div className="max-w-md">
      <h1 className="font-display font-bold text-2xl text-mk-dark mb-6">Mi cuenta</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-display font-bold text-base text-mk-dark flex items-center gap-2">
          <KeyRound className="w-4 h-4" /> Cambiar contraseña
        </h2>

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}
        {success && (
          <div role="status" className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
            Contraseña actualizada. La próxima vez que entres, usá la nueva.
          </div>
        )}

        <div>
          <label htmlFor="current" className={labelClass}>Contraseña actual</label>
          <input id="current" type={type} required autoComplete="current-password"
            value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label htmlFor="new" className={labelClass}>Contraseña nueva</label>
          <input id="new" type={type} required autoComplete="new-password" minLength={MIN_LENGTH}
            value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass}
            aria-describedby="new-help" />
          <p id="new-help" className={`text-xs mt-1 ${tooShort ? 'text-red-600' : 'text-gray-500'}`}>
            Mínimo {MIN_LENGTH} caracteres. Que no sea una que uses en otro lado.
          </p>
        </div>

        <div>
          <label htmlFor="confirm" className={labelClass}>Repetir contraseña nueva</label>
          <input id="confirm" type={type} required autoComplete="new-password"
            value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClass} />
          {mismatch && <p className="text-xs mt-1 text-red-600">No coincide con la contraseña nueva.</p>}
        </div>

        <button type="button" onClick={() => setShow(s => !s)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-mk-orange">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {show ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
        </button>

        <button type="submit" disabled={!canSave}
          className="w-full bg-mk-orange hover:bg-mk-orange-dark disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold px-4 py-2.5 rounded-lg transition-colors text-sm">
          {saving ? 'Guardando…' : 'Cambiar contraseña'}
        </button>
      </form>
    </div>
  )
}
