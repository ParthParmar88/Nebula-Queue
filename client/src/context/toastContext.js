import { createContext, useContext } from 'react'

/**
 * `toast({ title, description?, tone?: 'success' | 'danger' | 'info', action?: { label, onClick } })`
 */
export const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
