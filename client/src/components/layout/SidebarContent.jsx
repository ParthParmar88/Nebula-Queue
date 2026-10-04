import { FileText, FlaskConical, LayoutDashboard, ListChecks, Plus, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useLocation } from '../../lib/router'
import { useShell } from '../../context/shellContext.js'
import { useJobsQuery } from '../../hooks/useJobs'
import Button from '../ui/Button'
import Kbd from '../ui/Kbd'
import Link from '../ui/Link'
import ConnectionIndicator from './ConnectionIndicator'
import Logo from './Logo'
import UserMenu from './UserMenu'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, isActive: (path) => path === '/' },
  { to: '/jobs', label: 'Jobs', icon: ListChecks, isActive: (path) => path.startsWith('/jobs'), showActive: true },
  { to: '/documents', label: 'Documents', icon: FileText, isActive: (path) => path === '/documents' },
  { to: '/evals', label: 'Evaluations', icon: FlaskConical, isActive: (path) => path === '/evals' },
]

/**
 * Sidebar body, shared by the fixed desktop sidebar and the mobile slide-in sheet.
 * `onNavigate` closes the sheet after a choice; `onClose` adds a close button (sheet only).
 */
export default function SidebarContent({ onNavigate, onClose }) {
  const { path } = useLocation()
  const { openNewJob } = useShell()
  const { data: jobs } = useJobsQuery()
  const inFlight = jobs?.filter((j) => j.status === 'PENDING' || j.status === 'PROCESSING').length ?? 0

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <Link to="/" onClick={onNavigate} className="rounded-md" aria-label="Nebula Queue — overview">
          <Logo />
        </Link>
        {onClose && (
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close navigation">
            <X aria-hidden="true" />
          </Button>
        )}
      </div>

      <div className="px-3 pt-2">
        <Button
          variant="primary"
          className="w-full justify-between"
          onClick={() => {
            onNavigate?.()
            openNewJob()
          }}
        >
          <span className="flex items-center gap-2">
            <Plus aria-hidden="true" />
            New job
          </span>
          <Kbd className="hidden border-white/20 bg-white/15 text-accent-fg lg:inline-flex">N</Kbd>
        </Button>
      </div>

      <nav aria-label="Main" className="mt-5 flex flex-col gap-0.5 px-3">
        {NAV.map((item) => {
          const active = item.isActive(path)
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors',
                active ? 'bg-surface-3 font-medium text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
              )}
            >
              <Icon className={cn('size-4', active ? 'text-fg' : 'text-fg-subtle')} aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              {item.showActive && inFlight > 0 && (
                <span className="rounded bg-info-soft px-1.5 text-xs font-medium tabular-nums text-info">
                  {inFlight}
                  <span className="sr-only"> in progress</span>
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 border-t border-border p-3">
        <ConnectionIndicator />
        <UserMenu />
      </div>
    </div>
  )
}
