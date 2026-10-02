import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Menu, Plus } from 'lucide-react'
import { useAuth } from '../../context/authContext.js'
import { ShellContext } from '../../context/shellContext.js'
import { useApplyJobUpdate } from '../../hooks/useJobs'
import { useHotkey } from '../../hooks/useHotkey'
import { useJobSocket } from '../../hooks/useJobSocket'
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
  const [newJobOpen, setNewJobOpen] = useState(false)
  const mainRef = useRef(null)
  const isFirstRoute = useRef(true)

  const applyJobUpdate = useApplyJobUpdate()
  const realtimeConnected = useJobSocket({ token, isAdmin, onJobUpdate: applyJobUpdate })

  const openNewJob = useCallback(() => setNewJobOpen(true), [])
  const closeNewJob = useCallback(() => setNewJobOpen(false), [])
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
            <Button variant="primary" size="icon" onClick={openNewJob} aria-label="New job">
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

        <NewJobDialog open={newJobOpen} onClose={closeNewJob} />
      </div>
    </ShellContext.Provider>
  )
}
