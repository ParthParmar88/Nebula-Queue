import { ChevronRight } from 'lucide-react'
import { useNow } from '../../hooks/useNow'
import { formatDateTime, formatRelative, shortId } from '../../lib/format'
import { jobTypeMeta, resultSummary } from '../../lib/jobTypes'
import { navigate } from '../../lib/router'
import Button from '../ui/Button'
import Link from '../ui/Link'
import Skeleton from '../ui/Skeleton'
import StatusBadge from '../ui/StatusBadge'
import JobTypeIcon from './JobTypeIcon'

/**
 * Jobs as a table on tablet/desktop and as a stacked list on phones (a 6-column table
 * doesn't fit a 375px screen). Rows open the job's detail page.
 */
export default function JobsTable({ jobs, showOwner = false, onCancel, id }) {
  const now = useNow()

  return (
    <div id={id}>
      {/* ≥ md: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-13">
          <thead>
            <tr className="border-b border-border text-xs text-fg-muted">
              <th scope="col" className="h-10 px-4 font-medium">Job</th>
              <th scope="col" className="h-10 px-4 font-medium">Status</th>
              <th scope="col" className="h-10 px-4 font-medium">Result</th>
              {showOwner && <th scope="col" className="h-10 px-4 font-medium">Submitted by</th>}
              <th scope="col" className="h-10 px-4 font-medium">Created</th>
              <th scope="col" className="h-10 w-px px-4"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobs.map((job) => {
              const meta = jobTypeMeta(job.type)
              return (
                <tr
                  key={job.id}
                  onClick={(e) => {
                    if (!e.target.closest('a, button')) navigate(`/jobs/${job.id}`)
                  }}
                  className="group cursor-pointer transition-colors hover:bg-surface-2/60"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <JobTypeIcon type={job.type} />
                      <div className="min-w-0">
                        <Link to={`/jobs/${job.id}`} className="whitespace-nowrap rounded font-medium text-fg hover:underline">
                          {meta.label}
                          <span className="sr-only">, job {shortId(job.id)}</span>
                        </Link>
                        <div className="font-mono text-xs text-fg-muted" aria-hidden="true">
                          {shortId(job.id)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="max-w-64 px-4 py-3">
                    <span className="block truncate text-fg-muted" title={resultSummary(job).slice(0, 300) || undefined}>
                      {resultSummary(job) || <span className="text-fg-subtle">—</span>}
                    </span>
                  </td>
                  {showOwner && (
                    <td className="max-w-48 px-4 py-3">
                      <span className="block truncate text-fg-muted" title={job.submittedBy}>
                        {job.submittedBy}
                      </span>
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-3 text-fg-muted">
                    <time dateTime={job.createdAt} title={formatDateTime(job.createdAt)}>
                      {formatRelative(job.createdAt, now)}
                    </time>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {job.status === 'PENDING' && onCancel && (
                        <Button variant="danger-ghost" size="sm" onClick={() => onCancel(job)}>
                          Cancel
                          <span className="sr-only"> job {shortId(job.id)}</span>
                        </Button>
                      )}
                      <ChevronRight
                        className="size-4 text-fg-subtle transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* < md: list */}
      <ul className="divide-y divide-border md:hidden">
        {jobs.map((job) => {
          const meta = jobTypeMeta(job.type)
          return (
            <li key={job.id}>
              <Link
                to={`/jobs/${job.id}`}
                className="flex items-start gap-3 px-4 py-3.5 transition-colors active:bg-surface-2"
              >
                <JobTypeIcon type={job.type} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-fg">{meta.label}</span>
                    <StatusBadge status={job.status} />
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-muted">
                    <span className="font-mono">{shortId(job.id)}</span>
                    <span aria-hidden="true">·</span>
                    <time dateTime={job.createdAt}>{formatRelative(job.createdAt, now)}</time>
                    {showOwner && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{job.submittedBy}</span>
                      </>
                    )}
                  </div>
                  {resultSummary(job) && <p className="mt-1.5 truncate text-xs text-fg-muted">{resultSummary(job)}</p>}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function JobsTableSkeleton({ rows = 6 }) {
  return (
    <div aria-busy="true" aria-label="Loading jobs">
      <div className="hidden h-10 border-b border-border md:block" />
      <ul className="divide-y divide-border">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3.5">
            <Skeleton className="size-8 rounded-md" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="hidden h-3.5 w-40 md:block" />
            <Skeleton className="hidden h-3.5 w-16 md:block" />
          </li>
        ))}
      </ul>
    </div>
  )
}
