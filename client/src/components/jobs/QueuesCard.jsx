import { getErrorMessage } from '../../api/errors'
import { useQueueStats } from '../../hooks/useJobs'
import { cn } from '../../lib/cn'
import { formatNumber } from '../../lib/format'
import Badge from '../ui/Badge'
import { Card, CardHeader } from '../ui/Card'
import Skeleton from '../ui/Skeleton'

const ROLE_TONES = { work: 'info', retry: 'warning', 'dead-letter': 'danger', events: 'neutral' }

/** Admin view of RabbitMQ: backlog, retries waiting, dead letters, and consumers per queue. */
export default function QueuesCard() {
  const { data: queues, isPending, isError, error } = useQueueStats(true)
  const deadLetters = queues?.filter((q) => q.role === 'dead-letter').reduce((n, q) => n + q.messages, 0) ?? 0

  return (
    <Card>
      <CardHeader
        title="Queues"
        description="Live from RabbitMQ · refreshes every 10 s"
        action={deadLetters > 0 && <Badge tone="danger">{deadLetters} dead-lettered</Badge>}
      />
      {isPending ? (
        <div className="flex flex-col gap-3 px-5 py-4" aria-busy="true" aria-label="Loading queues">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="px-5 py-4 text-13 text-danger">{getErrorMessage(error)}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-13">
            <thead>
              <tr className="border-b border-border text-xs text-fg-muted">
                <th scope="col" className="h-9 px-5 font-medium">Queue</th>
                <th scope="col" className="h-9 px-3 font-medium">Role</th>
                <th scope="col" className="h-9 px-3 text-right font-medium">Messages</th>
                <th scope="col" className="h-9 px-5 text-right font-medium">Consumers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {queues.map((q) => (
                <tr key={q.name} className={cn(!q.exists && 'opacity-50')}>
                  <td className="px-5 py-2.5">
                    <p className="font-mono text-xs text-fg">{q.name}</p>
                    <p className="text-xs text-fg-muted">{q.exists ? q.description : 'Not created yet (its worker hasn’t started)'}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={ROLE_TONES[q.role] ?? 'neutral'}>{q.role}</Badge>
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2.5 text-right tabular-nums',
                      q.role === 'dead-letter' && q.messages > 0 ? 'font-semibold text-danger' : 'text-fg'
                    )}
                  >
                    {formatNumber(q.messages)}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-fg-muted">
                    {q.role === 'retry' || q.role === 'dead-letter' ? '—' : formatNumber(q.consumers)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
