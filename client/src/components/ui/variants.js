import { cva } from 'class-variance-authority'

/*
 * Shared style recipes. Kept apart from the components so anything (e.g. a link that
 * should look like a button) can reuse them, and so component files only export components.
 */

export const buttonVariants = cva(
  [
    'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium',
    'transition-[background-color,border-color,color,box-shadow,transform] duration-150',
    'active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-fg shadow-xs hover:bg-accent-hover',
        secondary: 'border border-border bg-surface text-fg shadow-xs hover:border-border-strong hover:bg-surface-2',
        ghost: 'text-fg-muted hover:bg-surface-2 hover:text-fg',
        danger: 'bg-danger text-danger-fg shadow-xs hover:bg-danger-hover',
        'danger-ghost': 'text-danger hover:bg-danger-soft',
      },
      size: {
        sm: 'h-8 px-2.5 text-13',
        md: 'h-10 px-3.5 text-sm sm:h-9',
        lg: 'h-11 px-5 text-sm',
        icon: 'size-10 sm:size-9',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  }
)

/** Base look shared by Input, Textarea, Select and SearchInput. */
export const fieldBase = [
  'w-full rounded-md border border-border bg-surface text-sm text-fg shadow-xs',
  'placeholder:text-fg-subtle transition-[border-color,box-shadow] duration-150',
  'hover:border-border-strong',
  'focus-visible:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15',
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-60',
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15',
].join(' ')

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-2 text-fg-muted ring-border',
        accent: 'bg-accent-soft text-accent-soft-fg ring-accent/20',
        success: 'bg-success-soft text-success ring-success/20',
        warning: 'bg-warning-soft text-warning ring-warning/25',
        danger: 'bg-danger-soft text-danger ring-danger/20',
        info: 'bg-info-soft text-info ring-info/20',
      },
    },
    defaultVariants: { tone: 'neutral' },
  }
)
