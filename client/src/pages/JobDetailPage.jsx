import { useState } from 'react'
import { ArrowLeft, ArrowUpRight, FileQuestion, Lock, RefreshCw } from 'lucide-react'
import { getErrorMessage, getErrorStatus } from '../api/errors'
import CancelJobDialog from '../components/jobs/CancelJobDialog'
import JobTimeline from '../components/jobs/JobTimeline'
import JobTypeIcon from '../components/jobs/JobTypeIcon'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import CopyButton from '../components/ui/CopyButton'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'
import StatusBadge from '../components/ui/StatusBadge'
import { buttonVariants } from '../components/ui/variants'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useJobQuery } from '../hooks/useJobs'
import { useNow } from '../hooks/useNow'
import { formatDateTime, formatDuration, formatRelative, isHttpUrl, prettyJson, shortId } from '../lib/format'
import { jobTypeMeta, STATUS_LABELS } from '../lib/jobTypes'

export default function JobDetailPage({ id }) {
  const { data: job, isPending, isError, error, refetch, isFetching } = useJobQuery(id)
  const [cancelOpen, setCancelOpen] = useState(false)
  const meta = job ? jobTypeMeta(job.type) : null
  useDocumentTitle(meta ? `${meta.label} ${shortId(id)}` : `Job ${shortId(id)}`)

  const breadcrumbs = [{ label: 'Jobs', to: '/jobs' }, { label: shortId(id) }]

  if (isPending) return <DetailSkeleton breadcrumbs={breadcrumbs} />

  if (isError && !job) {
    const status = getErrorStatus(error)
    if (status === 404 || status === 403) {
      return (
        <Card className="mt-2">
          <EmptyState
            icon={status === 404 ? FileQuestion : Lock}
            title={status === 404 ? 'Job not found' : 'You don’t have access to this job'}
            description={
              status === 404
                ? `There’s no job with ID ${id}. It may have been removed, or the link is wrong.`
                : 'Jobs are only visible to the person who submitted them and to admins.'
            }
            action={
              <a href="#/jobs" className={buttonVariants({ variant: 'secondary' })}>
                <ArrowLeft aria-hidden="true" />
                Back to jobs
              </a>
            }
          />
        </Card>
      )
    }
    return (
      <>
        <PageHeader breadcrumbs={breadcrumbs} title="Job" />
        <Alert
          tone="danger"
          title="Couldn’t load this job"
          action={
            <Button size="sm" onClick={() => refetch()} loading={isFetching}>
              <RefreshCw aria-hidden="true" />
              Retry
            </Button>
          }
        >
          {getErrorMessage(error)}
        </Alert>
      </>
    )
  }

  return (
    <>
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={
          <span className="flex items-center gap-3">
            <JobTypeIcon type={job.type} size="lg" />
            {meta.label}
          </span>
        }
        actions={
          job.status === 'PENDING' && (
            <Button variant="secondary" onClick={() => setCancelOpen(true)} className="text-danger hover:text-danger">
              Cancel job
            </Button>
          )
        }
      >
        <JobMeta job={job} />
      </PageHeader>

      <div className="flex flex-col gap-6">
        <StatusBanner job={job} />

        <div className="grid items-start gap-6 lg:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
            {job.status === 'COMPLETED' && <ResultCard result={job.resultUrl} />}
            <PayloadCard payload={job.payload} />
          </div>
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader title="Lifecycle" />
              <div className="px-5 py-4">
                <JobTimeline job={job} />
              </div>
            </Card>
            <DetailsCard job={job} />
          </div>
        </div>
      </div>

      <CancelJobDialog job={cancelOpen ? job : null} onClose={() => setCancelOpen(false)} />
    </>
  )
}

function JobMeta({ job }) {
  const now = useNow()
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-13 text-fg-muted">
      <StatusBadge status={job.status} />
      <span className="flex items-center gap-0.5">
        <span className="font-mono text-xs">{job.id}</span>
        <CopyButton value={job.id} label="Copy job ID" />
      </span>
      <span>
        Submitted <time dateTime={job.createdAt} title={formatDateTime(job.createdAt)}>{formatRelative(job.createdAt, now)}</time>
      </span>
    </div>
  )
}

function StatusBanner({ job }) {
  switch (job.status) {
    case 'PENDING':
      return (
        <Alert tone="warning" title="Waiting in the queue">
          A worker will pick this job up as soon as one is free. This page updates on its own.
        </Alert>
      )
    case 'PROCESSING':
      return (
        <Alert tone="info" title="Processing">
          A worker is running this job now. The result will appear here when it finishes.
        </Alert>
      )
    case 'FAILED':
      return (
        <Alert tone="danger" title="This job failed">
          <span className="break-words">{job.resultUrl?.replace(/^Error:\s*/, '') || 'The worker didn’t report a reason.'}</span>
        </Alert>
      )
    case 'CANCELLED':
      return (
        <Alert tone="info" title="Cancelled">
          This job was cancelled before a worker picked it up, so it never ran.
        </Alert>
      )
    default:
      return null
  }
}

function ResultCard({ result }) {
  return (
    <Card>
      <CardHeader title="Result" action={result && <CopyButton value={result} label="Copy result" align="end" />} />
      <div className="px-5 py-4 text-sm">
        {!result ? (
          <p className="text-fg-muted">The job finished without returning a result.</p>
        ) : isHttpUrl(result) ? (
          <a
            href={result}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 break-all font-medium text-accent-soft-fg hover:underline"
          >
            {result}
            <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
          </a>
        ) : (
          <p className="whitespace-pre-wrap break-words text-fg">{result}</p>
        )}
      </div>
    </Card>
  )
}

function PayloadCard({ payload }) {
  const formatted = prettyJson(payload)
  return (
    <Card>
      <CardHeader title="Payload" action={formatted && <CopyButton value={formatted} label="Copy payload" align="end" />} />
      <div className="p-4">
        {formatted ? (
          <pre className="max-h-96 overflow-auto rounded-md border border-border bg-surface-2 p-4 font-mono text-13 leading-relaxed text-fg">
            <code>{formatted}</code>
          </pre>
        ) : (
          <p className="px-1 text-sm text-fg-muted">No payload was submitted with this job.</p>
        )}
      </div>
    </Card>
  )
}

function DetailsCard({ job }) {
  const totalMs = job.completedAt ? new Date(job.completedAt) - new Date(job.createdAt) : null

  const rows = [
    ['Status', STATUS_LABELS[job.status] ?? job.status],
    ['Type', <span key="type" className="font-mono text-xs">{job.type}</span>],
    ['Submitted by', job.submittedBy || '—'],
    ['Created', formatDateTime(job.createdAt)],
    ['Last updated', formatDateTime(job.updatedAt)],
    ['Finished', job.completedAt ? formatDateTime(job.completedAt) : '—'],
    // includes time spent waiting in the queue
    ['Total time', totalMs != null ? formatDuration(totalMs) : '—'],
  ]

  return (
    <Card>
      <CardHeader title="Details" />
      <dl className="divide-y divide-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 px-5 py-2.5 text-13">
            <dt className="shrink-0 text-fg-muted">{label}</dt>
            <dd className="min-w-0 truncate text-right text-fg">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function DetailSkeleton({ breadcrumbs }) {
  return (
    <div aria-busy="true" aria-label="Loading job">
      <PageHeader breadcrumbs={breadcrumbs} title={<span className="sr-only">Loading job…</span>} className="mb-0 sm:mb-0" />
      <div className="mb-6 flex items-center gap-3 sm:mb-8">
        <Skeleton className="size-10 rounded-md" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-72 max-w-[60vw]" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-5 lg:col-span-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-4 h-32 w-full" />
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="mt-4 h-3 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
