import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn'
import Link from './Link'

/**
 * Page title block. `breadcrumbs` is `[{ label, to? }]`; the last item is the current page.
 * `actions` sit on the right on desktop and wrap below the title on phones.
 */
export default function PageHeader({ breadcrumbs, title, description, actions, className, children }) {
  return (
    <header className={cn('mb-6 sm:mb-8', className)}>
      {breadcrumbs && (
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1 text-13 text-fg-muted">
            {breadcrumbs.map((crumb, i) => {
              const last = i === breadcrumbs.length - 1
              return (
                <li key={crumb.label} className="flex items-center gap-1">
                  {crumb.to && !last ? (
                    <Link to={crumb.to} className="rounded transition-colors hover:text-fg">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current={last ? 'page' : undefined} className={last ? 'text-fg' : undefined}>
                      {crumb.label}
                    </span>
                  )}
                  {!last && <ChevronRight className="size-3.5 text-fg-subtle" aria-hidden="true" />}
                </li>
              )
            })}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
          {children}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
