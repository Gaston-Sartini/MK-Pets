'use client'

/**
 * VideoIntro — Intro animada que se muestra al primer load del sitio.
 *
 * Reglas:
 *  - Solo en desktop (≥ 768px). En mobile no se muestra.
 *  - Se muestra una sola vez por sesión (sessionStorage).
 *  - Auto-cierra al terminar el video o cuando el usuario presiona "Saltar".
 *  - Permite también cerrar con la tecla Escape.
 *
 * Para deshabilitar la intro entera, poner ENABLED = false abajo.
 */
import { useEffect, useRef, useState } from 'react'

const ENABLED = true
const STORAGE_KEY = 'mkpets-intro-seen'
const DESKTOP_MIN_WIDTH = 768

export function VideoIntro() {
  const [show, setShow] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Decidimos en el cliente si mostrar (depende de window + sessionStorage).
  useEffect(() => {
    if (!ENABLED) return
    if (typeof window === 'undefined') return

    const isDesktop = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`).matches
    if (!isDesktop) return

    let seen = false
    try {
      seen = window.sessionStorage.getItem(STORAGE_KEY) === '1'
    } catch {}
    if (seen) return

    setShow(true)
    // Marcamos como vista de una para no repetir si hay re-render.
    try {
      window.sessionStorage.setItem(STORAGE_KEY, '1')
    } catch {}
  }, [])

  // Cuando aparece, bloqueamos el scroll del body por debajo.
  useEffect(() => {
    if (!show) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [show])

  // Escape cierra la intro
  useEffect(() => {
    if (!show) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show])

  function close() {
    if (fadingOut) return
    setFadingOut(true)
    // Esperamos el fade-out para desmontar
    window.setTimeout(() => setShow(false), 500)
  }

  if (!show) return null

  return (
    <div
      className={
        'fixed inset-0 z-[10000] bg-black flex items-center justify-center ' +
        'transition-opacity duration-500 ' +
        (fadingOut ? 'opacity-0' : 'opacity-100')
      }
      role="dialog"
      aria-label="Introducción MK-Pets"
    >
      <video
        ref={videoRef}
        src="/intro.mp4"
        autoPlay
        muted
        playsInline
        onEnded={close}
        onError={close}
        className="max-w-full max-h-full object-contain"
      />

      <button
        type="button"
        onClick={close}
        className={
          'absolute top-6 right-6 px-4 py-2 rounded-pill text-sm font-semibold ' +
          'bg-white/90 hover:bg-white text-mk-dark shadow-card ' +
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mk-orange/40'
        }
        aria-label="Saltar introducción"
      >
        Saltar ›
      </button>
    </div>
  )
}
