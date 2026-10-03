import { LoaderCircle } from 'lucide-react'
import { formatCost, formatNumber } from '../../lib/format'
import { useJobStream } from '../../lib/jobStream'
import { Card, CardHeader } from '../ui/Card'
import CopyButton from '../ui/CopyButton'
import Skeleton from '../ui/Skeleton'

/**
 * The model's response. While the job runs, text streams in from the WebSocket; once it
 * completes, the output saved by the API is shown instead.
 */
export function AiOutputCard({ job }) {
  const stream = useJobStream(job.id)
  const running = job.status === 'PROCESSING'
  const text = job.status === 'COMPLETED' ? job.output : stream?.text

  return (
    <Card>
      <CardHeader
        title="Response"
        description={running ? 'Streaming live from the model' : job.model ?? undefined}
        action={job.status === 'COMPLETED' && text && <CopyButton value={text} label="Copy response" align="end" />}
      />
      <div className="px-5 py-4" aria-live={running ? 'polite' : undefined} aria-busy={running}>
        {job.status === 'PENDING' ? (
          <div className="flex flex-col gap-2.5" aria-label="Waiting for a worker">
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        ) : text ? (
          <>
            {stream?.partial && running && (
              <p className="mb-3 text-xs text-fg-muted">
                You opened this page mid-response, so the start is missing. The full text appears when it finishes.
              </p>
            )}
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg">
              {text}
              {running && (
                <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-accent" aria-hidden="true" />
              )}
            </p>
          </>
        ) : running ? (
          <p className="flex items-center gap-2 text-sm text-fg-muted">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Waiting for the first tokens…
          </p>
        ) : (
          <p className="text-sm text-fg-muted">
            {job.status === 'COMPLETED' ? 'The model returned an empty response.' : 'No response was produced.'}
          </p>
        )}
      </div>
    </Card>
  )
}

function parsePrompt(payload) {
  try {
    const data = JSON.parse(payload)
    return { prompt: typeof data.prompt === 'string' ? data.prompt : null, system: data.system ?? null }
  } catch {
    return { prompt: null, system: null }
  }
}

/** The prompt as the user wrote it, instead of the raw JSON payload. */
export function PromptCard({ payload }) {
  const { prompt, system } = parsePrompt(payload)
  return (
    <Card>
      <CardHeader title="Prompt" action={prompt && <CopyButton value={prompt} label="Copy prompt" align="end" />} />
      <div className="flex flex-col gap-4 px-5 py-4 text-sm">
        {system && (
          <div>
            <p className="mb-1 text-xs font-medium text-fg-muted">System instructions</p>
            <p className="whitespace-pre-wrap break-words text-fg-muted">{system}</p>
          </div>
        )}
        <div>
          {system && <p className="mb-1 text-xs font-medium text-fg-muted">Prompt</p>}
          <p className="whitespace-pre-wrap break-words text-fg">{prompt ?? payload ?? '—'}</p>
        </div>
      </div>
    </Card>
  )
}

/** Tokens and cost reported by the worker. */
export function UsageCard({ job }) {
  const hasUsage = job.inputTokens != null || job.outputTokens != null
  const total = hasUsage ? (job.inputTokens ?? 0) + (job.outputTokens ?? 0) : null

  const rows = [
    ['Model', job.model ? <span key="m" className="font-mono text-xs">{job.model}</span> : '—'],
    ['Input tokens', formatNumber(job.inputTokens)],
    ['Output tokens', formatNumber(job.outputTokens)],
    ['Total tokens', formatNumber(total)],
    ['Cost', job.costUsd != null ? formatCost(job.costUsd) : hasUsage ? 'Pricing not set' : '—'],
  ]

  return (
    <Card>
      <CardHeader title="Usage" />
      <dl className="divide-y divide-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 px-5 py-2.5 text-13">
            <dt className="shrink-0 text-fg-muted">{label}</dt>
            <dd className="min-w-0 truncate text-right tabular-nums text-fg">{value}</dd>
          </div>
        ))}
      </dl>
      {hasUsage && job.costUsd == null && (
        <p className="border-t border-border px-5 py-3 text-xs text-fg-muted">
          Set OPENAI_PRICE_INPUT_PER_1M and OPENAI_PRICE_OUTPUT_PER_1M on the AI worker to record cost.
        </p>
      )}
    </Card>
  )
}
