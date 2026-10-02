import { useEffect } from 'react'

function isTyping(target) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

/**
 * Single-key shortcut (e.g. "n", "/"). Ignored while typing in a field, with modifier keys
 * held, or while a modal dialog is open. Pass a stable `handler` (useCallback).
 */
export function useHotkey(key, handler, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    function onKeyDown(event) {
      if (event.key !== key || event.metaKey || event.ctrlKey || event.altKey) return
      if (isTyping(event.target) || document.querySelector('[aria-modal="true"]')) return
      event.preventDefault()
      handler(event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [key, handler, enabled])
}
