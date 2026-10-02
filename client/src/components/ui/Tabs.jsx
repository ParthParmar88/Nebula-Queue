import { useRef } from 'react'
import { cn } from '../../lib/cn'

/**
 * Single-select tab bar used to filter a list. Implements the WAI-ARIA tabs keyboard model
 * (arrow keys, Home/End, roving tabindex). `items`: `[{ value, label, count? }]`.
 */
export default function Tabs({ items, value, onChange, label, controls, className }) {
  const listRef = useRef(null)

  function onKeyDown(event) {
    const index = items.findIndex((item) => item.value === value)
    let next = null
    if (event.key === 'ArrowRight') next = (index + 1) % items.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    if (next === null) return
    event.preventDefault()
    onChange(items[next].value)
    listRef.current?.querySelectorAll('[role="tab"]')[next]?.focus()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('scrollbar-none -mx-1 flex items-center gap-0.5 overflow-x-auto px-1', className)}
    >
      {items.map((item) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={controls}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-13 font-medium transition-colors',
              selected ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
            )}
          >
            {item.label}
            {item.count != null && (
              <span className={cn('tabular-nums', selected ? 'text-fg-muted' : 'text-fg-subtle')}>{item.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
