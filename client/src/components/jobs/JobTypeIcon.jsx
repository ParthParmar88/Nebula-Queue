import { cn } from '../../lib/cn'
import { jobTypeMeta } from '../../lib/jobTypes'

export default function JobTypeIcon({ type, size = 'md', className }) {
  const Icon = jobTypeMeta(type).icon
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-fg-muted',
        size === 'lg' ? 'size-10 [&_svg]:size-5' : 'size-8 [&_svg]:size-4',
        className
      )}
      aria-hidden="true"
    >
      <Icon />
    </span>
  )
}
