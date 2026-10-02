import { useSyncExternalStore } from 'react'

/*
 * One shared 30-second clock for relative timestamps ("5 minutes ago"), so every row
 * doesn't run its own timer and render stays pure.
 */
const TICK_MS = 30_000
let now = Date.now()
let timer = null
const listeners = new Set()

function subscribe(listener) {
  listeners.add(listener)
  if (!timer) {
    now = Date.now()
    timer = setInterval(() => {
      now = Date.now()
      listeners.forEach((l) => l())
    }, TICK_MS)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      clearInterval(timer)
      timer = null
    }
  }
}

export function useNow() {
  return useSyncExternalStore(subscribe, () => now)
}
