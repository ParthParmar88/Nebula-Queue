import { createContext, useContext } from 'react'

/**
 * App-shell services available to every page:
 * `{ openNewJob(preset?), realtimeConnected }` — preset: `{ type, documentIds }`
 */
export const ShellContext = createContext(null)

export function useShell() {
  const ctx = useContext(ShellContext)
  if (!ctx) throw new Error('useShell must be used within AppShell')
  return ctx
}
