import { Children, cloneElement, isValidElement, useId } from 'react'
import { cn } from '../../lib/cn'

const SIDES = {
  top: 'bottom-full mb-2',
  bottom: 'top-full mt-2',
}

// Use `start`/`end` near screen edges so the label never overflows the viewport
const ALIGNS = {
  start: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-0',
}

/**
 * Small label shown on hover (after a short delay) and on keyboard focus. The trigger gets
 * `aria-describedby`, so screen readers announce it too. Use for icon-only buttons and
 * abbreviated values. Hidden with display:none, so it never affects layout or scrolling.
 */
export default function Tooltip({ content, side = 'top', align = 'center', className, children }) {
  const id = useId()
  const child = Children.only(children)

  return (
    <span className={cn('group/tooltip relative inline-flex', className)}>
      {isValidElement(child) ? cloneElement(child, { 'aria-describedby': id }) : child}
      <span
        id={id}
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 hidden whitespace-nowrap rounded-md bg-fg px-2 py-1 text-xs font-medium text-bg shadow-overlay',
          'group-hover/tooltip:block group-hover/tooltip:animate-[fade-in_150ms_ease-out_300ms_both]',
          'group-focus-within/tooltip:block group-focus-within/tooltip:animate-fade-in',
          SIDES[side],
          ALIGNS[align]
        )}
      >
        {content}
      </span>
    </span>
  )
}
