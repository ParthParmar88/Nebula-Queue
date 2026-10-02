import { cn } from '../../lib/cn'

export default function Kbd({ className, children }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface-2 px-1',
        'font-sans text-2xs font-medium text-fg-muted',
        className
      )}
    >
      {children}
    </kbd>
  )
}
