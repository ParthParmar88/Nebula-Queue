import { useEffect } from 'react'

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Nebula Queue` : 'Nebula Queue'
  }, [title])
}
