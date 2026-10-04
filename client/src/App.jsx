import AppShell from './components/layout/AppShell'
import { useAuth } from './context/authContext.js'
import { matchPath, useLocation } from './lib/router'
import AuthPage from './pages/AuthPage'
import DocumentsPage from './pages/DocumentsPage'
import EvaluationsPage from './pages/EvaluationsPage'
import JobDetailPage from './pages/JobDetailPage'
import JobsPage from './pages/JobsPage'
import NotFoundPage from './pages/NotFoundPage'
import OverviewPage from './pages/OverviewPage'

export default function App() {
  const { isAuthenticated } = useAuth()

  // Signed-out users see the sign-in page at any URL; after signing in they land on the
  // page they asked for (the hash is kept).
  if (!isAuthenticated) return <AuthPage />

  return (
    <AppShell>
      <Routes />
    </AppShell>
  )
}

function Routes() {
  const { path } = useLocation()

  if (path === '/') return <OverviewPage />
  if (path === '/jobs') return <JobsPage />
  if (path === '/documents') return <DocumentsPage />
  if (path === '/evals') return <EvaluationsPage />

  const job = matchPath('/jobs/:id', path)
  if (job) return <JobDetailPage key={job.id} id={job.id} />

  return <NotFoundPage />
}
