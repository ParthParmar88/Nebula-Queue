import { cn } from '../../lib/cn'
import { badgeVariants } from './variants'

/** @param {'neutral'|'accent'|'success'|'warning'|'danger'|'info'} tone */
export default function Badge({ tone, className, children, ...props }) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {children}
    </span>
  )
}
