import { ChevronDown, CircleCheck, CircleX, LoaderCircle } from 'lucide-react'
import { cn } from '../../lib/cn'
import { formatDuration, formatRate, formatScore, scoreTone } from '../../lib/format'
import { useJobStream } from '../../lib/jobStream'
import Badge from '../ui/Badge'
import { Card, CardHeader } from '../ui/Card'

const METRICS = [
  { key: 'correctness', label: 'Correctness', hint: 'Matches the expected answer (LLM judge)', format: formatScore },
  { key: 'faithfulness', label: 'Faithfulness', hint: 'Claims supported by retrieved passages (LLM judge)', format: formatScore },
  { key: 'retrievalHitRate', label: 'Retrieval hit', hint: 'Expected source was retrieved', format: formatRate },
  { key: 'citationValidity', label: 'Valid citations', hint: 'Answers cite only sources that exist', format: formatRate },
]

/** Headline scores for a finished evaluation. */
export function EvalSummary({ report }) {
  const s = report.summary
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {METRICS.map((m) => {
        const value = s[m.key]
        return (
          <div key={m.key} className="rounded-lg border border-border bg-surface p-4 shadow-xs" title={m.hint}>
            <p className="text-13 font-medium text-fg-muted">{m.label}</p>
            <p
              className={cn(
                'mt-1.5 text-2xl font-semibold tabular-nums tracking-tight',
                value == null ? 'text-fg-subtle' : { success: 'text-success', warning: 'text-warning', danger: 'text-danger' }[scoreTone(value)]
              )}
            >
              {m.format(value)}
            </p>
            <p className="mt-1 truncate text-xs text-fg-muted">
              {m.key === 'retrievalHitRate'
                ? s.retrievalCases
                  ? `${s.retrievalCases} case${s.retrievalCases === 1 ? '' : 's'} checked`
                  : 'No expected sources set'
                : m.hint}
            </p>
          </div>
        )
      })}
    </div>
  )
}

/** Every case with its scores; expand one to see the answer, the judge's reasoning and the sources. */
export function EvalCasesCard({ report }) {
  return (
    <Card>
      <CardHeader
        title="Cases"
        description={`${report.cases.length} case${report.cases.length === 1 ? '' : 's'} · average ${formatDuration(report.summary.avgLatencyMs)} per answer`}
      />
      <ol className="divide-y divide-border">
        {report.cases.map((c, i) => (
          <li key={i}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-start gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2/60 [&::-webkit-details-marker]:hidden">
                <span className="mt-0.5 text-xs font-medium tabular-nums text-fg-subtle">{i + 1}</span>
                <span className="min-w-0 flex-1 text-13 text-fg">{c.question}</span>
                <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  <Badge tone={scoreTone(c.correctness)} title="Correctness">C {formatScore(c.correctness)}</Badge>
                  <Badge tone={scoreTone(c.faithfulness)} title="Faithfulness">F {formatScore(c.faithfulness)}</Badge>
                  {c.retrievalHit != null && (
                    <Badge tone={c.retrievalHit ? 'success' : 'danger'}>{c.retrievalHit ? 'Hit' : 'Miss'}</Badge>
                  )}
                  <ChevronDown className="size-4 text-fg-subtle transition-transform group-open:rotate-180" aria-hidden="true" />
                </span>
              </summary>
              <div className="flex flex-col gap-4 bg-surface-2/40 px-5 pb-5 pt-1 text-13">
                <Block label="Expected answer">{c.expected}</Block>
                <Block label="Answer">{c.answer}</Block>
                <Block label="Judge’s reasoning">{c.reasoning || '—'}</Block>
                <p className="flex items-center gap-1.5 text-fg-muted">
                  {c.citationsValid ? (
                    <CircleCheck className="size-3.5 text-success" aria-hidden="true" />
                  ) : (
                    <CircleX className="size-3.5 text-danger" aria-hidden="true" />
                  )}
                  {c.citationsValid ? 'Citations point at retrieved sources' : 'Missing or invalid citations'}
                  <span aria-hidden="true">·</span>
                  {formatDuration(c.latencyMs)}
                </p>
                {c.sources.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-fg-muted">Retrieved passages</p>
                    <ul className="flex flex-col gap-1.5">
                      {c.sources.map((s) => (
                        <li key={s.n} className="flex items-center gap-2 text-fg-muted">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded bg-accent-soft text-2xs font-semibold text-accent-soft-fg">
                            {s.n}
                          </span>
                          <span className="min-w-0 truncate text-fg">{s.filename}</span>
                          {s.page != null && <span className="shrink-0">· page {s.page}</span>}
                          <span className="ml-auto shrink-0 tabular-nums text-fg-subtle">{Math.round(s.score * 100)}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          </li>
        ))}
      </ol>
    </Card>
  )
}

function Block({ label, children }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-fg-muted">{label}</p>
      <p className="whitespace-pre-wrap break-words text-fg">{children}</p>
    </div>
  )
}

/** The settings this run used — what you change between runs to compare. */
export function EvalConfigCard({ report }) {
  const rows = [
    ['Top-k', report.topK],
    ['Answer model', <span key="m" className="font-mono text-xs">{report.model}</span>],
    ['Judge model', <span key="j" className="font-mono text-xs">{report.judgeModel}</span>],
    ['Embeddings', <span key="e" className="font-mono text-xs">{report.embeddingModel}</span>],
    ['Documents', report.documents.map((d) => d.filename).join(', ')],
  ]
  return (
    <Card>
      <CardHeader title="Configuration" />
      <dl className="divide-y divide-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 px-5 py-2.5 text-13">
            <dt className="shrink-0 text-fg-muted">{label}</dt>
            <dd className="min-w-0 truncate text-right text-fg" title={typeof value === 'string' ? value : undefined}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

/** Live log while the evaluation runs: one line per finished case. */
export function EvalProgressCard({ job }) {
  const stream = useJobStream(job.id)
  const lines = (stream?.text ?? '').split('\n').filter(Boolean)
  return (
    <Card>
      <CardHeader title="Progress" description={job.status === 'PENDING' ? 'Waiting for a worker' : 'Scores appear as each case finishes'} />
      <div className="px-5 py-4" aria-live="polite">
        {lines.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-fg-muted">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            {job.status === 'PENDING' ? 'Queued…' : 'Starting…'}
          </p>
        ) : (
          <ol className="flex flex-col gap-1.5 font-mono text-xs text-fg-muted">
            {lines.map((line, i) => (
              <li key={i} className={i === lines.length - 1 ? 'text-fg' : undefined}>
                {line}
              </li>
            ))}
            <li className="flex items-center gap-2 text-fg-subtle">
              <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
              working…
            </li>
          </ol>
        )}
      </div>
    </Card>
  )
}
