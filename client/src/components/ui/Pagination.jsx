import { ChevronLeft, ChevronRight } from 'lucide-react'
import Button from './Button'
import { Select } from './Field'

const PAGE_SIZES = [10, 25, 50]

/** "Showing 1–25 of 132", rows-per-page, and previous/next. */
export default function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col-reverse items-center justify-between gap-3 px-1 text-13 text-fg-muted sm:flex-row"
    >
      <p aria-live="polite">
        Showing <span className="font-medium tabular-nums text-fg">{from}–{to}</span> of{' '}
        <span className="font-medium tabular-nums text-fg">{total}</span>
      </p>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="whitespace-nowrap">Rows per page</span>
          <Select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 w-[4.5rem] text-13 sm:h-8"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="secondary"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span className="min-w-14 text-center tabular-nums">
            {page} / {pageCount}
          </span>
          <Button
            size="icon-sm"
            variant="secondary"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            aria-label="Next page"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </nav>
  )
}
