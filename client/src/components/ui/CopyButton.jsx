import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '../../lib/cn'
import Tooltip from './Tooltip'

/** Icon button that copies `value` and briefly confirms with a check mark. */
export default function CopyButton({ value, label = 'Copy', align, className }) {
  const [copied, setCopied] = useState(false)

  async function copy(event) {
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be unavailable (e.g. non-secure origin); fail quietly
    }
  }

  return (
    <Tooltip content={copied ? 'Copied' : label} align={align}>
      <button
        type="button"
        onClick={copy}
        aria-label={label}
        className={cn(
          'inline-flex size-7 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg',
          className
        )}
      >
        {copied ? (
          <Check className="size-3.5 text-success" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
      </button>
    </Tooltip>
  )
}
