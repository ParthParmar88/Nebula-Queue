import { cn } from '../../lib/cn'

/** Mark: three bars of decreasing length — a queue draining. */
export function LogoMark({ className }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7 shrink-0', className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <rect x="8" y="9" width="16" height="3" rx="1.5" fill="#fff" />
      <rect x="8" y="14.5" width="11" height="3" rx="1.5" fill="#fff" fillOpacity=".7" />
      <rect x="8" y="20" width="6" height="3" rx="1.5" fill="#fff" fillOpacity=".4" />
    </svg>
  )
}

export default function Logo({ className }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight text-fg">Nebula Queue</span>
    </span>
  )
}
