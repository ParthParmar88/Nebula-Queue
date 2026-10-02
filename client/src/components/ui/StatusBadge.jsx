import { cn } from '../../lib/cn'
import { STATUS_LABELS } from '../../lib/jobTypes'
import Badge from './Badge'

const TONES = {
  PENDING: 'warning',
  PROCESSING: 'info',
  COMPLETED: 'success',
  FAILED: 'danger',
  CANCELLED: 'neutral',
}

export default function StatusBadge({ status, className }) {
  const tone = TONES[status] ?? 'neutral'
  return (
    <Badge tone={tone} className={className}>
      <span
        className={cn(
          'size-1.5 rounded-full bg-current',
          status === 'PROCESSING' && 'animate-pulse'
        )}
        aria-hidden="true"
      />
      {STATUS_LABELS[status] ?? status}
    </Badge>
  )
}
