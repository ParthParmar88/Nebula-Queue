import { LoaderCircle } from 'lucide-react'
import { cn } from '../../lib/cn'
import { buttonVariants } from './variants'

/**
 * @param {'primary'|'secondary'|'ghost'|'danger'|'danger-ghost'} variant
 * @param {'sm'|'md'|'lg'|'icon'|'icon-sm'} size
 * @param {boolean} loading  shows a spinner and disables the button
 */
export default function Button({
  variant,
  size,
  loading = false,
  disabled,
  type = 'button',
  className,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading && <LoaderCircle className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}
