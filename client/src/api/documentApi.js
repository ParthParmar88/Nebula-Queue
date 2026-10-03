import http from './http'

export const listDocuments = () => http.get('/api/documents')

/** Multipart upload; `onProgress` receives 0–100. */
export const uploadDocument = (file, onProgress) => {
  const form = new FormData()
  form.append('file', file)
  return http.post('/api/documents', form, {
    timeout: 120_000,
    onUploadProgress: (event) => {
      if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100))
    },
  })
}

export const deleteDocument = (id) => http.delete(`/api/documents/${encodeURIComponent(id)}`)
