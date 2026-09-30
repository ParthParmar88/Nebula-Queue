import { useState } from 'react'
import { submitJob } from '../api/jobApi'

const JOB_TYPES = ['BATCH', 'IMAGE_RESIZE', 'PDF_GENERATE', 'EMAIL_SEND']

export default function JobForm({ onJobSubmitted }) {
  const [type, setType] = useState('BATCH')
  const [payload, setPayload] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const trimmed = payload.trim()
    if (type === 'EMAIL_SEND' && !trimmed) {
      setError('EMAIL_SEND requires a JSON payload with to, subject, and body.')
      return
    }
    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed)
        if (type === 'EMAIL_SEND' && (!parsed.to || !parsed.subject || !parsed.body)) {
          setError('EMAIL_SEND payload must include to, subject, and body.')
          return
        }
      } catch {
        setError('Payload must be valid JSON (or leave it empty).')
        return
      }
    }

    setLoading(true)
    try {
      const res = await submitJob(type, trimmed || null)
      onJobSubmitted(res.data)
      setPayload('')
      setSuccess(`Job submitted (${res.data.id.slice(0, 8)}…)`)
    } catch (err) {
      const d = err.response?.data
      let msg = 'Failed to submit job'
      if (err.response?.status === 401) {
        msg = 'Session expired or not signed in. Please sign in again.'
      } else if (!err.response) {
        msg =
          'Cannot reach the API. Open the app at http://localhost:5173 (Vite dev server) and ensure the API is running on port 9090.'
      } else if (typeof d === 'string') msg = d
      else if (d?.message) msg = d.message
      else if (d?.title) msg = d.title
      setError(msg)
      console.error('Failed to submit job', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Submit new job</h2>

      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium text-gray-600 mb-1 block">Job type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {JOB_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 mb-1 block">
            Payload{' '}
            <span className="text-gray-400">
              {type === 'EMAIL_SEND' ? '(required JSON for email)' : '(optional JSON)'}
            </span>
          </label>
          {type === 'EMAIL_SEND' && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
              Worker needs <code className="font-mono">EMAIL_USER</code> and{' '}
              <code className="font-mono">EMAIL_PASS</code> in the environment (Gmail app password).
            </p>
          )}
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            placeholder='{"to":"a@b.com","subject":"Hi","body":"Hello"}'
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {success && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{success}</p>
        )}
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
        >
          {loading ? 'Submitting…' : 'Submit job'}
        </button>
      </div>
    </form>
  )
}
