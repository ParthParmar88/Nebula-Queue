import { useState, useEffect, useCallback } from 'react'
import { getMyJobs, getAllJobs, cancelJob } from './api/jobApi'
import { useJobSocket } from './hooks/useJobSocket'
import { useAuth } from './context/authContext.js'
import AuthPanel from './components/AuthPanel'
import JobForm from './components/JobForm'
import JobTable from './components/JobTable'

export default function App() {
  const { isAuthenticated, isAdmin, email, token, logout } = useAuth()
  const [jobs, setJobs] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)

  const loadJobs = useCallback(async () => {
    setLoadError(null)
    try {
      const res = isAdmin ? await getAllJobs() : await getMyJobs()
      setJobs(res.data)
    } catch (err) {
      console.error('Failed to load jobs', err)
      setLoadError('Could not load jobs. Check that the API is running.')
    }
  }, [isAdmin])

  useEffect(() => {
    if (!isAuthenticated) {
      setJobs([])
      return
    }
    loadJobs()
  }, [isAuthenticated, loadJobs])

  function handleJobSubmitted(newJob) {
    // The socket may already have delivered a newer version (e.g. PROCESSING) before
    // the POST response arrived — keep that one.
    setJobs((prev) => (prev.some((j) => j.id === newJob.id) ? prev : [newJob, ...prev]))
  }

  // Socket messages carry the full job: replace it in place, or add it if it's new
  const upsertJob = useCallback((job) => {
    setJobs((prev) =>
      prev.some((j) => j.id === job.id)
        ? prev.map((j) => (j.id === job.id ? job : j))
        : [job, ...prev]
    )
  }, [])

  const socketConnected = useJobSocket({ token, isAdmin, onJobUpdate: upsertJob })

  async function handleCancelJob(id) {
    setCancellingId(id)
    try {
      const { data } = await cancelJob(id)
      upsertJob(data)
    } catch (err) {
      console.error('Cancel failed', err)
    } finally {
      setCancellingId(null)
    }
  }

  const counts = {
    total: jobs.length,
    pending: jobs.filter((j) => j.status === 'PENDING').length,
    processing: jobs.filter((j) => j.status === 'PROCESSING').length,
    completed: jobs.filter((j) => j.status === 'COMPLETED').length,
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <AuthPanel />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Nebula Queue</h1>
            <p className="text-sm text-gray-500">
              {email}
              {isAdmin && (
                <span className="ml-2 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5">
                  Admin
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-2 text-sm text-gray-500">
              <span
                className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}
              />
              {socketConnected ? 'Live updates' : 'Connecting…'}
            </span>
            <button
              type="button"
              onClick={logout}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: counts.total, color: 'text-gray-800' },
            { label: 'Pending', value: counts.pending, color: 'text-yellow-600' },
            { label: 'Processing', value: counts.processing, color: 'text-blue-600' },
            { label: 'Completed', value: counts.completed, color: 'text-green-600' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm text-center"
            >
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {loadError && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">{loadError}</p>
        )}

        <JobForm onJobSubmitted={handleJobSubmitted} />

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            {isAdmin ? 'All jobs' : 'My jobs'}
            <span className="ml-2 text-sm font-normal text-gray-400">(WebSocket status updates)</span>
          </h2>
          <JobTable jobs={jobs} onCancelJob={handleCancelJob} cancellingId={cancellingId} />
        </div>
      </main>
    </div>
  )
}
