import { cn } from '../../lib/cn'
import { useShell } from '../../context/shellContext.js'
import Tooltip from '../ui/Tooltip'

/** Whether live job updates are flowing. `compact` shows only the dot (mobile top bar). */
export default function ConnectionIndicator({ compact = false, side = 'top', align = 'start' }) {
  const { realtimeConnected: live } = useShell()
  const label = live ? 'Live' : 'Reconnecting…'
  const explanation = live
    ? 'Job status updates stream in real time'
    : 'Live updates paused — reconnecting to the server'

  return (
    <Tooltip content={explanation} side={side} align={align}>
      <span
        tabIndex={0}
        role="status"
        className={cn(
          'inline-flex items-center gap-2 rounded-md text-13 text-fg-muted',
          compact ? 'size-9 justify-center' : 'h-8 px-2'
        )}
      >
        <span className="relative flex size-2">
          {live && <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-40" />}
          <span className={cn('relative inline-flex size-2 rounded-full', live ? 'bg-success' : 'bg-warning')} />
        </span>
        <span className={compact ? 'sr-only' : undefined}>{label}</span>
      </span>
    </Tooltip>
  )
}
