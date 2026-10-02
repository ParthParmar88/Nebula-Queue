import { Check, LoaderCircle, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { formatDateTime } from '../../lib/format'

/**
 * Lifecycle derived from status and timestamps. The API doesn't record when processing
 * started, so that step shows no time rather than a guessed one.
 */
function buildSteps(job) {
  const { status } = job
  const submitted = { label: 'Submitted', detail: formatDateTime(job.createdAt), state: 'done' }

  if (status === 'CANCELLED') {
    return [submitted, { label: 'Cancelled', detail: formatDateTime(job.updatedAt), state: 'stopped' }]
  }

  const started = ['PROCESSING', 'COMPLETED', 'FAILED'].includes(status)
  const processing = {
    label: 'Picked up by a worker',
    detail: status === 'PROCESSING' ? 'In progress…' : started ? null : 'Waiting in the queue',
    state: status === 'PROCESSING' ? 'current' : started ? 'done' : 'upcoming',
  }

  let finished
  if (status === 'COMPLETED') finished = { label: 'Completed', detail: formatDateTime(job.completedAt), state: 'done' }
  else if (status === 'FAILED') finished = { label: 'Failed', detail: formatDateTime(job.completedAt), state: 'stopped' }
  else finished = { label: 'Finished', detail: null, state: 'upcoming' }

  return [submitted, processing, finished]
}

const MARKERS = {
  done: { className: 'border-success/30 bg-success-soft text-success', icon: Check },
  current: { className: 'border-info/30 bg-info-soft text-info', icon: LoaderCircle, spin: true },
  stopped: { className: 'border-danger/30 bg-danger-soft text-danger', icon: X },
  upcoming: { className: 'border-border bg-surface text-fg-subtle', icon: null },
}

export default function JobTimeline({ job }) {
  const steps = buildSteps(job)
  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => {
        const marker = MARKERS[step.state]
        const Icon = marker.icon
        const last = i === steps.length - 1
        return (
          <li key={step.label} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && <span className="absolute left-[11px] top-7 h-[calc(100%-1.75rem)] w-px bg-border" aria-hidden="true" />}
            <span
              className={cn('relative flex size-6 shrink-0 items-center justify-center rounded-full border', marker.className)}
              aria-hidden="true"
            >
              {Icon ? (
                <Icon className={cn('size-3.5', marker.spin && 'animate-spin')} />
              ) : (
                <span className="size-1.5 rounded-full bg-current" />
              )}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={cn('text-13 font-medium', step.state === 'upcoming' ? 'text-fg-subtle' : 'text-fg')}>
                {step.label}
                <span className="sr-only">
                  {' '}
                  ({step.state === 'upcoming' ? 'not yet' : step.state === 'current' ? 'in progress' : step.state})
                </span>
              </p>
              {step.detail && <p className="mt-0.5 text-xs text-fg-muted">{step.detail}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
