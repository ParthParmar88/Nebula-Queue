import { Children, cloneElement, isValidElement, useId } from 'react'
import { ChevronDown, CircleAlert } from 'lucide-react'
import { cn } from '../../lib/cn'
import { fieldBase } from './variants'

/**
 * Label + control + hint/error, wired up for screen readers. The single child control
 * receives `id`, `aria-describedby` and `aria-invalid` automatically.
 */
export function Field({ label, hint, error, optional = false, action, className, children }) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  // The error replaces the hint visually, so only reference the one that is rendered
  const describedBy = error ? errorId : hint ? hintId : undefined

  const control = Children.only(children)
  const wired = isValidElement(control)
    ? cloneElement(control, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })
    : control

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {(label || action) && (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={id} className="text-13 font-medium text-fg">
            {label}
            {optional && <span className="ml-1.5 font-normal text-fg-subtle">Optional</span>}
          </label>
          {action}
        </div>
      )}
      {wired}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-13 text-danger">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-13 text-fg-muted">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

export function Input({ className, ...props }) {
  return <input className={cn(fieldBase, 'h-10 px-3 sm:h-9', className)} {...props} />
}

export function Textarea({ className, ...props }) {
  return <textarea className={cn(fieldBase, 'min-h-24 resize-y px-3 py-2 leading-relaxed', className)} {...props} />
}

export function Select({ className, children, ...props }) {
  return (
    <div className="relative">
      <select className={cn(fieldBase, 'h-10 appearance-none pl-3 pr-8 sm:h-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
        aria-hidden="true"
      />
    </div>
  )
}
