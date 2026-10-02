/**
 * Turn an axios error into a sentence for the UI. The API returns
 * `{ status, error, message }` (GlobalExceptionHandler); older endpoints return a plain string.
 */
export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback
  if (!err.response) {
    return 'Can’t reach the server. Check that the API is running and try again.'
  }
  const data = err.response.data
  if (typeof data === 'string' && data.trim()) return data
  if (data?.message) return data.message
  return fallback
}

export function getErrorStatus(err) {
  return err?.response?.status ?? null
}
