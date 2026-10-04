import { ArrowRight, Plus, RefreshCw } from 'lucide-react'
import { getErrorMessage } from '../api/errors'
import JobTypeIcon from '../components/jobs/JobTypeIcon'
import QueuesCard from '../components/jobs/QueuesCard'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import Link from '../components/ui/Link'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'
import StatusBadge from '../components/ui/StatusBadge'
import { useAuth } from '../context/authContext.js'
import { useShell } from '../context/shellContext.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useJobsQuery } from '../hooks/useJobs'
import { useNow } from '../hooks/useNow'
import { cn } from '../lib/cn'
import { formatCompact, formatCost, formatNumber, formatRelative, shortId } from '../lib/format'
import { ALL_JOB_TYPES, isAiJob, jobTypeMeta } from '../lib/jobTypes'

const RECENT_COUNT = 6

export default function OverviewPage() {
  useDocumentTitle('Overview')
  const { isAdmin } = useAuth()
  const { openNewJob } = useShell()
  const { data: jobs, isPending, isError, error, refetch, isRefetching } = useJobsQuery()

  return (
    <>
      <PageHeader
        title="Overview"
        description={isAdmin ? 'Queue activity across every user.' : 'Activity for the jobs you’ve submitted.'}
        actions={
          <Button variant="primary" onClick={openNewJob}>
            <Plus aria-hidden="true" />
            New job
          </Button>
        }
      />

      {isPending ? (
        <OverviewSkeleton />
      ) : isError ? (
        <Alert
          tone="danger"
          title="Couldn’t load your jobs"
          action={
            <Button size="sm" onClick={() => refetch()} loading={isRefetching}>
              <RefreshCw aria-hidden="true" />
              Retry
            </Button>
          }
        >
          {getErrorMessage(error)}
        </Alert>
      ) : jobs.length === 0 ? (
        <GettingStarted onNewJob={openNewJob} />
      ) : (
        <div className="flex flex-col gap-6">
          <StatTiles jobs={jobs} />
          <div className="grid items-start gap-6 lg:grid-cols-3">
            <RecentJobs jobs={jobs} className="lg:col-span-2" />
            <div className="flex flex-col gap-6">
              <AiUsage jobs={jobs} />
              <JobTypeBreakdown jobs={jobs} />
            </div>
          </div>
          {isAdmin && <QueuesCard />}
        </div>
      )}
    </>
  )
}

function StatTiles({ jobs }) {
  const count = (status) => jobs.filter((j) => j.status === status).length
  const pending = count('PENDING')
  const processing = count('PROCESSING')
  const completed = count('COMPLETED')
  const failed = count('FAILED')
  const finished = completed + failed
  const successRate = finished ? Math.round((completed / finished) * 100) : null

  const tiles = [
    { status: 'PENDING', label: 'Pending', value: pending, caption: 'Waiting in the queue' },
    { status: 'PROCESSING', label: 'Processing', value: processing, caption: 'Running on a worker' },
    {
      status: 'COMPLETED',
      label: 'Completed',
      value: completed,
      caption: successRate == null ? 'Nothing finished yet' : `${successRate}% success rate`,
    },
    {
      status: 'FAILED',
      label: 'Failed',
      value: failed,
      caption: failed ? 'Review the errors' : 'No failures',
      alert: failed > 0,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Link
          key={tile.status}
          to={`/jobs?status=${tile.status}`}
          className="group rounded-lg border border-border bg-surface p-4 shadow-xs transition-colors hover:border-border-strong sm:p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-13 font-medium text-fg-muted">{tile.label}</span>
            <ArrowRight
              className="size-3.5 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden="true"
            />
          </div>
          <p className={cn('mt-2 text-2xl font-semibold tabular-nums tracking-tight', tile.alert ? 'text-danger' : 'text-fg')}>
            {tile.value}
          </p>
          <p className="mt-1 truncate text-xs text-fg-muted">{tile.caption}</p>
        </Link>
      ))}
    </div>
  )
}

function RecentJobs({ jobs, className }) {
  const now = useNow()
  const recent = jobs.slice(0, RECENT_COUNT)

  return (
    <Card className={className}>
      <CardHeader
        title="Recent jobs"
        description={`Latest ${recent.length} of ${jobs.length}`}
        action={
          <Link to="/jobs" className="flex items-center gap-1 rounded text-13 font-medium text-fg-muted hover:text-fg">
            View all
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        }
      />
      <ul className="divide-y divide-border">
        {recent.map((job) => (
          <li key={job.id}>
            <Link to={`/jobs/${job.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2/60">
              <JobTypeIcon type={job.type} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-13 font-medium text-fg">{jobTypeMeta(job.type).label}</p>
                <p className="font-mono text-xs text-fg-muted">{shortId(job.id)}</p>
              </div>
              <time dateTime={job.createdAt} className="hidden text-xs text-fg-muted sm:block">
                {formatRelative(job.createdAt, now)}
              </time>
              <StatusBadge status={job.status} />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** Totals across AI jobs: what the model work has cost so far. Hidden until there is any. */
function AiUsage({ jobs }) {
  const aiJobs = jobs.filter(isAiJob)
  if (aiJobs.length === 0) return null

  const sum = (pick) => aiJobs.reduce((total, job) => total + (Number(pick(job)) || 0), 0)
  const inputTokens = sum((j) => j.inputTokens)
  const outputTokens = sum((j) => j.outputTokens)
  const priced = aiJobs.filter((j) => j.costUsd != null)
  const spend = priced.length ? sum((j) => j.costUsd) : null

  const stats = [
    { label: 'AI jobs', value: formatNumber(aiJobs.length) },
    { label: 'Tokens', value: formatCompact(inputTokens + outputTokens), title: `${formatNumber(inputTokens)} in · ${formatNumber(outputTokens)} out` },
    { label: 'Spend', value: formatCost(spend) },
  ]

  return (
    <Card>
      <CardHeader title="AI usage" description="Tokens and spend across your AI jobs" />
      <dl className="grid grid-cols-3 divide-x divide-border">
        {stats.map((stat) => (
          <div key={stat.label} className="px-4 py-4 text-center" title={stat.title}>
            <dt className="text-xs text-fg-muted">{stat.label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-fg">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function JobTypeBreakdown({ jobs }) {
  const total = jobs.length
  // Only types that have been used — seven rows of zeros would be noise
  const rows = ALL_JOB_TYPES.map((type) => ({
    type,
    count: jobs.filter((j) => j.type === type).length,
  })).filter((row) => row.count > 0)

  return (
    <Card>
      <CardHeader title="By job type" description={`${total} job${total === 1 ? '' : 's'} total`} />
      <ul className="flex flex-col gap-4 px-5 py-4">
        {rows.map(({ type, count }) => {
          const share = total ? Math.round((count / total) * 100) : 0
          return (
            <li key={type}>
              <div className="flex items-center justify-between text-13">
                <span className="text-fg">{jobTypeMeta(type).label}</span>
                <span className="tabular-nums text-fg-muted">
                  {count}
                  <span className="sr-only"> jobs, {share}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${share}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function GettingStarted({ onNewJob }) {
  const steps = [
    { title: 'Submit a job', text: 'Pick a job type and give it a payload — an email to send, for example.' },
    { title: 'It’s queued', text: 'The API stores it and hands it to RabbitMQ; the next free worker picks it up.' },
    { title: 'Watch it run', text: 'Status changes appear here live — no refreshing needed.' },
  ]
  return (
    <Card className="px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-lg font-semibold tracking-tight text-fg">Submit your first job</h2>
        <p className="mt-1.5 text-sm text-fg-muted">Nothing has run yet. Here’s how a job moves through Nebula Queue.</p>
      </div>
      <ol className="mx-auto mt-8 grid max-w-3xl gap-6 sm:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="flex flex-col gap-2">
            <span className="flex size-7 items-center justify-center rounded-full border border-border bg-surface-2 text-xs font-semibold tabular-nums text-fg-muted">
              {i + 1}
            </span>
            <p className="text-13 font-medium text-fg">{step.title}</p>
            <p className="text-13 text-fg-muted">{step.text}</p>
          </li>
        ))}
      </ol>
      <div className="mt-10 flex justify-center">
        <Button variant="primary" onClick={onNewJob}>
          <Plus aria-hidden="true" />
          New job
        </Button>
      </div>
    </Card>
  )
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading overview">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4 sm:p-5">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="mt-3 h-7 w-12" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface lg:col-span-2">
          <div className="border-b border-border px-5 py-4">
            <Skeleton className="h-4 w-28" />
          </div>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0">
              <Skeleton className="size-8 rounded-md" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="mt-5 h-3 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
