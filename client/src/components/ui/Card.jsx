import { cn } from '../../lib/cn'

export function Card({ as = 'section', className, children, ...props }) {
  const Tag = as
  return (
    <Tag className={cn('rounded-lg border border-border bg-surface shadow-xs', className)} {...props}>
      {children}
    </Tag>
  )
}

/** Card title row. `action` sits on the right (e.g. a "View all" link). */
export function CardHeader({ title, description, action, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-border px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-13 text-fg-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
