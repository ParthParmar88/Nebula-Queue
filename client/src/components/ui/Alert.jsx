import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { cn } from '../../lib/cn'

const TONES = {
  info: { icon: Info, className: 'border-info/25 bg-info-soft [&_svg]:text-info' },
  success: { icon: CircleCheck, className: 'border-success/25 bg-success-soft [&_svg]:text-success' },
  warning: { icon: TriangleAlert, className: 'border-warning/30 bg-warning-soft [&_svg]:text-warning' },
  danger: { icon: CircleAlert, className: 'border-danger/25 bg-danger-soft [&_svg]:text-danger' },
}

/** Inline message. Danger alerts are announced immediately (role="alert"). */
export default function Alert({ tone = 'info', title, action, className, children }) {
  const { icon: Icon, className: toneClass } = TONES[tone]
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border px-4 py-3 text-13', toneClass, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium text-fg">{title}</p>}
        {children && <div className={cn('text-fg-muted', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}
