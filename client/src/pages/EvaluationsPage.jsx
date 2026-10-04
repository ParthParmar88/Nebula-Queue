import { useMemo } from 'react'
import { FlaskConical, Minus, Plus, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import { getErrorMessage } from '../api/errors'
import { EvalSummary } from '../components/jobs/EvalReport'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Link from '../components/ui/Link'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'
import StatusBadge from '../components/ui/StatusBadge'
import { useShell } from '../context/shellContext.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useJobsQuery } from '../hooks/useJobs'
import { useNow } from '../hooks/useNow'
import { cn } from '../lib/cn'
import { formatCost, formatDateTime, formatRate, formatRelative, formatScore } from '../lib/format'
import { parseReport } from '../lib/jobTypes'

export default function EvaluationsPage() {
  useDocumentTitle('Evaluations')
  const { openNewJob } = useShell()
  const { data: jobs, isPending, isError, error, refetch, isFetching } = useJobsQuery()

  // Newest first; each completed run is compared with the completed run before it
  const runs = useMemo(() => {
    const evals = (jobs ?? []).filter((j) => j.type === 'EVAL_RUN').map((job) => ({ job, report: parseReport(job.report) }))
    return evals.map((run, i) => ({
      ...run,
      previous: run.report ? evals.slice(i + 1).find((r) => r.report)?.report ?? null : null,
    }))
  }, [jobs])
  const latest = runs.find((r) => r.report)

  return (
    <>
      <PageHeader
        title="Evaluations"
        description="Score document Q&A on test questions with known answers. Change top-k or your documents, re-run, and compare."
        actions={
          <Button variant="primary" onClick={() => openNewJob({ type: 'EVAL_RUN' })}>
            <Plus aria-hidden="true" />
            New evaluation
          </Button>
        }
      />

      {isPending ? (
        <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading evaluations">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-lg" />
        </div>
      ) : isError ? (
        <Alert
          tone="danger"
          title="Couldn’t load evaluations"
          action={
            <Button size="sm" onClick={() => refetch()} loading={isFetching}>
              <RefreshCw aria-hidden="true" />
              Retry
            </Button>
          }
        >
          {getErrorMessage(error)}
        </Alert>
      ) : runs.length === 0 ? (
        <Card>
          <EmptyState
            icon={FlaskConical}
            title="No evaluations yet"
            description="Write a few questions whose answers you know, and get correctness, faithfulness and retrieval scores for your document Q&A — then change a setting and see if it gets better."
            action={
              <Button variant="primary" onClick={() => openNewJob({ type: 'EVAL_RUN' })}>
                <Plus aria-hidden="true" />
                New evaluation
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {latest && (
            <section aria-labelledby="latest-run" className="flex flex-col gap-3">
              <h2 id="latest-run" className="text-sm font-semibold text-fg">
                Latest run · <span className="font-normal text-fg-muted">{latest.report.name}</span>
              </h2>
              <EvalSummary report={latest.report} />
            </section>
          )}
          <RunsTable runs={runs} />
        </div>
      )}
    </>
  )
}

function RunsTable({ runs }) {
  const now = useNow()
  return (
    <Card>
      <CardHeader title="Runs" description="Changes are relative to the previous completed run" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-13">
          <thead>
            <tr className="border-b border-border text-xs text-fg-muted">
              <th scope="col" className="h-10 px-4 font-medium">Run</th>
              <th scope="col" className="h-10 px-4 font-medium">Correctness</th>
              <th scope="col" className="h-10 px-4 font-medium">Faithfulness</th>
              <th scope="col" className="h-10 px-4 font-medium">Retrieval hit</th>
              <th scope="col" className="h-10 px-4 font-medium">Citations</th>
              <th scope="col" className="h-10 px-4 text-right font-medium">Top-k</th>
              <th scope="col" className="h-10 px-4 text-right font-medium">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {runs.map(({ job, report, previous }) => {
              const s = report?.summary
              const p = previous?.summary
              return (
                <tr key={job.id} className="transition-colors hover:bg-surface-2/60">
                  <td className="px-4 py-3">
                    <Link to={`/jobs/${job.id}`} className="rounded font-medium text-fg hover:underline">
                      {report?.name ?? 'Evaluation'}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-fg-muted">
                      <time dateTime={job.createdAt} title={formatDateTime(job.createdAt)}>
                        {formatRelative(job.createdAt, now)}
                      </time>
                      {s ? <span>· {s.cases} cases</span> : <StatusBadge status={job.status} />}
                    </div>
                  </td>
                  <ScoreCell value={s?.correctness} previous={p?.correctness} />
                  <ScoreCell value={s?.faithfulness} previous={p?.faithfulness} />
                  <ScoreCell value={s?.retrievalHitRate} previous={p?.retrievalHitRate} rate />
                  <ScoreCell value={s?.citationValidity} previous={p?.citationValidity} rate />
                  <td className="px-4 py-3 text-right tabular-nums text-fg-muted">{report?.topK ?? '–'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-fg-muted">{s ? formatCost(job.costUsd) : '–'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/** A score plus its change from the previous run (green up, red down). */
function ScoreCell({ value, previous, rate = false }) {
  const format = rate ? formatRate : formatScore
  const delta = value != null && previous != null ? value - previous : null
  const flat = delta != null && Math.abs(delta) < 0.005
  const DeltaIcon = delta == null ? null : flat ? Minus : delta > 0 ? TrendingUp : TrendingDown

  return (
    <td className="px-4 py-3">
      <span className="flex items-center gap-2">
        <span className="font-medium tabular-nums text-fg">{format(value)}</span>
        {DeltaIcon && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs tabular-nums',
              flat ? 'text-fg-subtle' : delta > 0 ? 'text-success' : 'text-danger'
            )}
          >
            <DeltaIcon className="size-3" aria-hidden="true" />
            {!flat && (rate ? `${delta > 0 ? '+' : ''}${Math.round(delta * 100)}pt` : `${delta > 0 ? '+' : ''}${delta.toFixed(2)}`)}
            <span className="sr-only">{flat ? ' unchanged from the previous run' : ' compared with the previous run'}</span>
          </span>
        )}
      </span>
    </td>
  )
}
