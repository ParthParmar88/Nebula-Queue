import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Menu, Plus } from 'lucide-react'
import { useAuth } from '../../context/authContext.js'
import { ShellContext } from '../../context/shellContext.js'
import { useRefreshDocuments } from '../../hooks/useDocuments'
import { useApplyJobUpdate } from '../../hooks/useJobs'
import { useHotkey } from '../../hooks/useHotkey'
import { useJobSocket } from '../../hooks/useJobSocket'
import { appendDelta, clearStream } from '../../lib/jobStream'
import { isFinished, JOB_TYPES } from '../../lib/jobTypes'
import { useLocation } from '../../lib/router'
import NewJobDialog from '../jobs/NewJobDialog'
import Button from '../ui/Button'
import { Sheet } from '../ui/Dialog'
import Link from '../ui/Link'
import ConnectionIndicator from './ConnectionIndicator'
import Logo from './Logo'
import SidebarContent from './SidebarContent'

/**
 * Signed-in layout: fixed sidebar on desktop, top bar + slide-in navigation below `lg`.
 * Owns the live-update socket and the "New job" dialog so they work on every page.
 */
export default function AppShell({ children }) {
  const { token, isAdmin } = useAuth()
  const { path } = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  // null = closed; otherwise the dialog's preset ({ type?, documentIds? })
  const [newJob, setNewJob] = useState(null)
  const mainRef = useRef(null)
  const isFirstRoute = useRef(true)

  const applyJobUpdate = useApplyJobUpdate()
  const refreshDocuments = useRefreshDocuments()
  const onJobUpdate = useCallback(
    (job) => {
      applyJobUpdate(job)
      if (isFinished(job.status)) {
        // The saved output replaces the live text once the job is done
        clearStream(job.id)
        // An indexing job finishing means a document became ready (or failed)
        if (job.type === 'INGEST_DOCUMENT') refreshDocuments()
      } else if (job.status === 'PENDING') {
        // Back in the queue for a retry: drop the failed attempt's partial text. The next
        // attempt restarts its chunk numbering at 0, which would otherwise look like duplicates.
        clearStream(job.id)
      }
    },
    [applyJobUpdate, refreshDocuments]
  )
  const realtimeConnected = useJobSocket({ token, isAdmin, onJobUpdate, onStreamDelta: appendDelta })

  // Also used directly as onClick/hotkey handlers, whose events have a `type` too ("click"),
  // so only accept presets naming a real job type
  const openNewJob = useCallback((preset) => setNewJob(JOB_TYPES[preset?.type] ? preset : {}), [])
  const closeNewJob = useCallback(() => setNewJob(null), [])
  const closeNav = useCallback(() => setNavOpen(false), [])
  useHotkey('n', openNewJob)

  // On navigation: start at the top, and move focus to the page so screen readers announce it
  useEffect(() => {
    if (isFirstRoute.current) {
      isFirstRoute.current = false
      return
    }
    window.scrollTo(0, 0)
    mainRef.current?.focus({ preventScroll: true })
  }, [path])

  const shell = useMemo(() => ({ openNewJob, realtimeConnected }), [openNewJob, realtimeConnected])

  return (
    <ShellContext.Provider value={shell}>
      <div className="min-h-dvh lg:pl-60">
        <button
          type="button"
          onClick={() => mainRef.current?.focus()}
          className="sr-only z-50 rounded-md bg-surface px-3 py-2 text-sm font-medium shadow-overlay focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </button>

        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-surface lg:block">
          <SidebarContent />
        </aside>

        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-surface/90 px-2 backdrop-blur-sm sm:px-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            aria-expanded={navOpen}
          >
            <Menu aria-hidden="true" />
          </Button>
          <Link to="/" className="rounded-md" aria-label="Nebula Queue — overview">
            <Logo />
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <ConnectionIndicator compact side="bottom" align="end" />
            <Button variant="primary" size="icon" onClick={() => openNewJob()} aria-label="New job">
              <Plus aria-hidden="true" />
            </Button>
          </div>
        </header>

        <Sheet open={navOpen} onClose={closeNav} label="Navigation">
          <SidebarContent onNavigate={closeNav} onClose={closeNav} />
        </Sheet>

        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl px-4 py-6 focus:outline-none sm:px-6 sm:py-8 lg:px-10 lg:py-10"
        >
          {children}
        </main>

        <NewJobDialog open={newJob !== null} preset={newJob} onClose={closeNewJob} />
      </div>
    </ShellContext.Provider>
  )
}
