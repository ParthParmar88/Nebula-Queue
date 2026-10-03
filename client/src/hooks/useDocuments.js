import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteDocument, listDocuments, uploadDocument } from '../api/documentApi'
import { useAuth } from '../context/authContext.js'

const documentsKey = (email) => ['documents', email]

/**
 * The user's documents. Indexing status changes arrive as INGEST_DOCUMENT job updates over
 * the socket (see AppShell); while something is indexing we also poll slowly, in case the
 * socket is down.
 */
export function useDocumentsQuery() {
  const { email } = useAuth()
  return useQuery({
    queryKey: documentsKey(email),
    queryFn: async () => (await listDocuments()).data,
    refetchInterval: (query) => (query.state.data?.some((d) => d.status === 'PROCESSING') ? 5000 : false),
  })
}

export function useRefreshDocuments() {
  const { email } = useAuth()
  const queryClient = useQueryClient()
  return useCallback(() => queryClient.invalidateQueries({ queryKey: documentsKey(email) }), [queryClient, email])
}

export function useUploadDocument() {
  const refresh = useRefreshDocuments()
  return useMutation({
    mutationFn: async ({ file, onProgress }) => (await uploadDocument(file, onProgress)).data,
    onSuccess: refresh,
  })
}

export function useDeleteDocument() {
  const refresh = useRefreshDocuments()
  return useMutation({
    mutationFn: async (id) => {
      await deleteDocument(id)
    },
    onSuccess: refresh,
  })
}
