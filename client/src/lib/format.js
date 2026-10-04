const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'medium',
})

const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

const RELATIVE_UNITS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/** "Sep 30, 2026, 4:05:12 PM" in the viewer's locale and timezone. */
export function formatDateTime(iso) {
  if (!iso) return '—'
  return dateTimeFormat.format(new Date(iso))
}

/** "just now", "5 minutes ago", "yesterday"… relative to `now` (ms). */
export function formatRelative(iso, now) {
  if (!iso) return '—'
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  if (Math.abs(seconds) < 45) return 'just now'
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size || unit === 'minute') {
      return relativeFormat.format(Math.round(seconds / size), unit)
    }
  }
  return 'just now'
}

/** Milliseconds → "850 ms", "3.2 s", "4 min 12 s". */
export function formatDuration(ms) {
  if (ms == null || Number.isNaN(ms) || ms < 0) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return seconds ? `${minutes} min ${seconds} s` : `${minutes} min`
}

const integerFormat = new Intl.NumberFormat()
const compactFormat = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

/** 12,345 */
export function formatNumber(n) {
  return n == null ? '—' : integerFormat.format(n)
}

/** 12.3K — for headline totals */
export function formatCompact(n) {
  return n == null ? '—' : compactFormat.format(n)
}

/** "$0.0042", "$1.27" — small LLM costs need more precision than cents. */
export function formatCost(usd) {
  if (usd == null) return '—'
  const value = Number(usd)
  if (value === 0) return '$0.00'
  if (value < 0.0001) return '<$0.0001'
  return value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`
}

/** 0.873 → "0.87"; null → "–" (not scored). */
export function formatScore(score) {
  return score == null ? '–' : Number(score).toFixed(2)
}

/** 0.873 → "87%"; null → "–". */
export function formatRate(rate) {
  return rate == null ? '–' : `${Math.round(Number(rate) * 100)}%`
}

/** Badge tone for a 0–1 score: green ≥ 0.8, amber ≥ 0.5, red below, neutral when unscored. */
export function scoreTone(score) {
  if (score == null) return 'neutral'
  return score >= 0.8 ? 'success' : score >= 0.5 ? 'warning' : 'danger'
}

export function shortId(id) {
  return id ? id.slice(0, 8) : ''
}

/** Pretty-print a JSON string; returns the input unchanged if it isn't valid JSON. */
export function prettyJson(text) {
  if (!text) return ''
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

export function isHttpUrl(text) {
  return typeof text === 'string' && /^https?:\/\/\S+$/i.test(text)
}

export function initials(email) {
  if (!email) return '?'
  const name = email.split('@')[0]
  const parts = name.split(/[._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || name[0].toUpperCase()
}
