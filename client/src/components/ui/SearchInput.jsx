import { Search, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { fieldBase } from './variants'
import Kbd from './Kbd'

/** Search box with a leading icon, a clear button, and an optional keyboard-shortcut hint. */
export default function SearchInput({ value, onChange, shortcut, className, ref, ...props }) {
  return (
    <div className={cn('relative', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
        aria-hidden="true"
      />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.stopPropagation()
            onChange('')
          }
        }}
        className={cn(fieldBase, 'h-10 pl-9 pr-9 sm:h-9 [&::-webkit-search-cancel-button]:appearance-none')}
        {...props}
      />
      <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="flex size-7 items-center justify-center rounded text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
            aria-label="Clear search"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : (
          shortcut && <Kbd className="mr-1 hidden sm:inline-flex">{shortcut}</Kbd>
        )}
      </div>
    </div>
  )
}
