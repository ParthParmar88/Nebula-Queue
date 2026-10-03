import { useCallback, useSyncExternalStore } from 'react'

/*
 * Live text of AI jobs while they generate, keyed by job id. Kept outside React Query:
 * chunks arrive many times a second and only the job page that shows them should re-render.
 * Once a job finishes, its saved `output` (from the API) replaces this.
 */

const streams = new Map() // jobId → { text, nextSeq, partial }
const listeners = new Map() // jobId → Set<() => void>

function notify(jobId) {
  listeners.get(jobId)?.forEach((listener) => listener())
}

/** Called for every `{ jobId, seq, delta }` chunk from the WebSocket. */
export function appendDelta({ jobId, seq, delta }) {
  const current = streams.get(jobId)
  const expected = current?.nextSeq ?? 0
  if (seq < expected) return // duplicate or late chunk

  streams.set(jobId, {
    text: (current?.text ?? '') + delta,
    nextSeq: seq + 1,
    // Opened the page mid-generation, or a chunk was lost: the text has a gap
    partial: Boolean(current?.partial) || seq !== expected,
  })
  notify(jobId)
}

export function clearStream(jobId) {
  if (streams.delete(jobId)) notify(jobId)
}

/** `{ text, partial }` for a job that is generating right now, or null. */
export function useJobStream(jobId) {
  const subscribe = useCallback(
    (listener) => {
      if (!listeners.has(jobId)) listeners.set(jobId, new Set())
      listeners.get(jobId).add(listener)
      return () => listeners.get(jobId)?.delete(listener)
    },
    [jobId]
  )
  return useSyncExternalStore(subscribe, () => streams.get(jobId) ?? null)
}
