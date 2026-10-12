'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Avisa al servidor que se vio una página, para las estadísticas del panel.
 * No usa cookies ni identifica a la persona: manda solo la ruta.
 */
export function VisitBeacon() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return
    const body = JSON.stringify({ path: pathname })
    try {
      // sendBeacon no demora la navegación ni se corta si la persona cambia de página
      if (!navigator.sendBeacon?.('/api/visita', new Blob([body], { type: 'application/json' }))) {
        fetch('/api/visita', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {})
      }
    } catch {}
  }, [pathname])

  return null
}
