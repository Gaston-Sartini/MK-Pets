'use client'

import { useEffect } from 'react'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { useToastStore } from '@/store/toast-store'
import { cn } from '@/lib/utils'
import type { Toast as ToastType } from '@/store/toast-store'

const CONFIG = {
  success: { icon: CheckCircle2, iconClass: 'text-mk-success' },
  error:   { icon: AlertCircle,  iconClass: 'text-mk-error'   },
  info:    { icon: Info,         iconClass: 'text-blue-400'   },
}

function ToastItem({ toast }: { toast: ToastType }) {
  const { removeToast } = useToastStore()
  const { icon: Icon, iconClass } = CONFIG[toast.type]

  // role="alert" implies aria-live="assertive" — use for errors only.
  // For success/info use role="status" (aria-live="polite") to avoid interrupting screen readers.
  const role = toast.type === 'error' ? 'alert' : 'status'

  return (
    <div
      role={role}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-[14px]',
        'bg-mk-dark text-white font-body text-sm',
        'shadow-[0_8px_32px_rgba(0,0,0,0.25)]',
        'animate-slide-in-right'
      )}
    >
      <Icon className={cn('w-5 h-5 flex-shrink-0', iconClass)} aria-hidden="true" />
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="p-0.5 opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
        aria-label="Cerrar notificación"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const { toasts } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div
      aria-label="Notificaciones"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-auto sm:max-w-sm
                 z-50 flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  )
}
