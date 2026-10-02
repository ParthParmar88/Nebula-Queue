import { cn } from '../../lib/cn'

/** Placeholder block shown while data loads. Purely visual — pair it with an aria-busy region. */
export default function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded bg-surface-3', className)} aria-hidden="true" />
}
