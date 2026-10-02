import { useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useModal } from '../../hooks/useModal'
import Button from './Button'

const SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
}

/**
 * Centered dialog on larger screens; a bottom sheet on phones (easier to reach).
 * `footer` renders in a sticky action bar.
 */
export function Dialog({ open, onClose, title, description, size = 'md', footer, children }) {
  const panelRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()
  useModal(open, onClose, panelRef)

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade-in bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92dvh] w-full animate-zoom-in flex-col overflow-hidden border border-border bg-surface shadow-overlay',
          'rounded-t-xl sm:rounded-lg focus:outline-none',
          SIZES[size]
        )}
      >
        <div className={cn('flex items-start justify-between gap-4 px-5 pt-5 sm:px-6', children ? 'pb-3' : 'pb-5')}>
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold tracking-tight text-fg">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-13 text-fg-muted">
                {description}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1">
            <X aria-hidden="true" />
          </Button>
        </div>
        {children && <div className="flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>}
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-border bg-surface-2/60 px-5 py-3 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

/** Slide-in panel from the left — used for navigation on small screens. */
export function Sheet({ open, onClose, label, children }) {
  const panelRef = useRef(null)
  useModal(open, onClose, panelRef)

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 animate-fade-in bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="relative flex h-full w-72 max-w-[85vw] animate-slide-in-left flex-col border-r border-border bg-surface shadow-overlay focus:outline-none"
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
