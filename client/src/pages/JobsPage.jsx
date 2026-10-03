import { useCallback, useMemo, useRef, useState } from 'react'
import { Inbox, Plus, RefreshCw, SearchX } from 'lucide-react'
import { getErrorMessage } from '../api/errors'
import CancelJobDialog from '../components/jobs/CancelJobDialog'
import JobsTable, { JobsTableSkeleton } from '../components/jobs/JobsTable'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import Pagination from '../components/ui/Pagination'
import SearchInput from '../components/ui/SearchInput'
import Tabs from '../components/ui/Tabs'
import Tooltip from '../components/ui/Tooltip'
import { useAuth } from '../context/authContext.js'
import { useShell } from '../context/shellContext.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useHotkey } from '../hooks/useHotkey'
import { useJobsQuery } from '../hooks/useJobs'
import { cn } from '../lib/cn'
import { jobTypeMeta, STATUS_LABELS, STATUSES } from '../lib/jobTypes'
import { buildPath, navigate, useLocation } from '../lib/router'

const DEFAULT_PAGE_SIZE = 25
const TABLE_ID = 'jobs-results'

function matchesSearch(job, query) {
  if (!query) return true
  const haystack = [job.id, job.type, jobTypeMeta(job.type).label, job.submittedBy, job.resultUrl, job.output]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export default function JobsPage() {
  useDocumentTitle('Jobs')
  const { isAdmin } = useAuth()
  const { openNewJob } = useShell()
  const { data: jobs, isPending, isError, error, refetch, isFetching } = useJobsQuery()
  const [cancelTarget, setCancelTarget] = useState(null)
  const searchRef = useRef(null)

  // Filters live in the URL so they survive reloads and can be shared or bookmarked
  const { params } = useLocation()
  const status = STATUSES.includes(params.get('status')) ? params.get('status') : 'ALL'
  const query = params.get('q') ?? ''
  const pageSize = [10, 25, 50].includes(Number(params.get('size'))) ? Number(params.get('size')) : DEFAULT_PAGE_SIZE
  const requestedPage = Math.max(1, Number(params.get('page')) || 1)

  const setParams = useCallback(
    (patch) => {
      const current = { status: status === 'ALL' ? '' : status, q: query, page: requestedPage, size: pageSize }
      const next = { ...current, ...patch }
      if (next.page === 1) next.page = ''
      if (next.size === DEFAULT_PAGE_SIZE) next.size = ''
      navigate(buildPath('/jobs', next), { replace: true })
    },
    [status, query, requestedPage, pageSize]
  )

  const focusSearch = useCallback(() => searchRef.current?.focus(), [])
  useHotkey('/', focusSearch)

  const normalizedQuery = query.trim().toLowerCase()
  const searched = useMemo(
    () => (jobs ?? []).filter((job) => matchesSearch(job, normalizedQuery)),
    [jobs, normalizedQuery]
  )
  const filtered = status === 'ALL' ? searched : searched.filter((job) => job.status === status)

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const page = Math.min(requestedPage, pageCount)
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)

  const tabs = [
    { value: 'ALL', label: 'All', count: searched.length },
    ...STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s], count: searched.filter((j) => j.status === s).length })),
  ]

  const hasFilters = status !== 'ALL' || normalizedQuery !== ''

  return (
    <>
      <PageHeader
        title="Jobs"
        description={isAdmin ? 'Every job across all users, newest first.' : 'Everything you’ve submitted, newest first.'}
        actions={
          <>
            <Tooltip content="Refresh">
              <Button size="icon" onClick={() => refetch()} disabled={isPending} aria-label="Refresh jobs">
                <RefreshCw className={cn(isFetching && !isPending && 'animate-spin')} aria-hidden="true" />
              </Button>
            </Tooltip>
            <Button variant="primary" onClick={openNewJob}>
              <Plus aria-hidden="true" />
              New job
            </Button>
          </>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            label="Filter by status"
            items={tabs}
            value={status}
            controls={TABLE_ID}
            onChange={(value) => setParams({ status: value === 'ALL' ? '' : value, page: 1 })}
          />
          <SearchInput
            ref={searchRef}
            value={query}
            onChange={(value) => setParams({ q: value, page: 1 })}
            placeholder={isAdmin ? 'Search ID, type, user…' : 'Search ID, type, result…'}
            aria-label="Search jobs"
            shortcut="/"
            className="w-full lg:w-72 lg:shrink-0"
          />
        </div>

        {isPending ? (
          <JobsTableSkeleton />
        ) : isError ? (
          <div className="p-4">
            <Alert
              tone="danger"
              title="Couldn’t load jobs"
              action={
                <Button size="sm" onClick={() => refetch()} loading={isFetching}>
                  Retry
                </Button>
              }
            >
              {getErrorMessage(error)}
            </Alert>
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No jobs yet"
            description="Jobs you submit show up here, with their status updating live as workers process them."
            action={
              <Button variant="primary" onClick={openNewJob}>
                <Plus aria-hidden="true" />
                New job
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No matching jobs"
            description={
              normalizedQuery
                ? `Nothing matches “${query.trim()}”${status !== 'ALL' ? ` with status ${STATUS_LABELS[status]}` : ''}.`
                : `You have no ${STATUS_LABELS[status].toLowerCase()} jobs right now.`
            }
            action={
              hasFilters && (
                <Button onClick={() => setParams({ status: '', q: '', page: 1 })}>Clear filters</Button>
              )
            }
          />
        ) : (
          <>
            <JobsTable id={TABLE_ID} jobs={visible} showOwner={isAdmin} onCancel={setCancelTarget} />
            {filtered.length > 10 && (
              <div className="border-t border-border px-3 py-3">
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={filtered.length}
                  onPageChange={(p) => setParams({ page: p })}
                  onPageSizeChange={(size) => setParams({ size, page: 1 })}
                />
              </div>
            )}
          </>
        )}
      </Card>

      <CancelJobDialog job={cancelTarget} onClose={() => setCancelTarget(null)} />
    </>
  )
}
