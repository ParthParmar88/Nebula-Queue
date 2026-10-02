import { useCallback, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { cn } from '../lib/cn'
import { ToastContext } from './toastContext.js'

const DURATION_MS = 5000
const MAX_VISIBLE = 3

const ICONS = {
  success: { icon: CircleCheck, className: 'text-success' },
  danger: { icon: CircleAlert, className: 'text-danger' },
  info: { icon: Info, className: 'text-info' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    ({ title, description, tone = 'success', action }) => {
      const id = ++nextId.current
      setToasts((list) => [...list, { id, title, description, tone, action }].slice(-MAX_VISIBLE))
      setTimeout(() => dismiss(id), DURATION_MS)
    },
    [dismiss]
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <section
          aria-label="Notifications"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end sm:p-6"
        >
          {toasts.map((t) => {
            const { icon: Icon, className } = ICONS[t.tone] ?? ICONS.info
            return (
              <div
                key={t.id}
                role={t.tone === 'danger' ? 'alert' : 'status'}
                className="pointer-events-auto flex w-full max-w-sm animate-slide-in-up items-start gap-3 rounded-lg border border-border bg-surface p-3.5 shadow-overlay"
              >
                <Icon className={cn('mt-0.5 size-4 shrink-0', className)} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-13 font-medium text-fg">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-13 text-fg-muted">{t.description}</p>}
                  {t.action && (
                    <button
                      type="button"
                      onClick={() => {
                        t.action.onClick()
                        dismiss(t.id)
                      }}
                      className="mt-2 rounded text-13 font-medium text-accent-soft-fg hover:underline"
                    >
                      {t.action.label}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss notification"
                  className="-m-1 flex size-6 items-center justify-center rounded text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            )
          })}
        </section>,
        document.body
      )}
    </ToastContext.Provider>
  )
}
