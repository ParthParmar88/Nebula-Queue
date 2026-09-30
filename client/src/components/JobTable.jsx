import StatusBadge from './StatusBadge'

function truncate(s, max = 48) {
  if (!s) return '—'
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

export default function JobTable({ jobs, onCancelJob, cancellingId }) {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        No jobs yet. Submit one above.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-semibold text-gray-600">ID</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600">Result</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600">Created</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600 w-28">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {jobs.map((job) => (
            <tr key={job.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-mono text-gray-500 text-xs">
                {job.id.slice(0, 8)}…
              </td>
              <td className="px-4 py-3 font-medium text-gray-800">{job.type}</td>
              <td className="px-4 py-3">
                <StatusBadge status={job.status} />
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs max-w-xs" title={job.resultUrl || ''}>
                {truncate(job.resultUrl, 40)}
              </td>
              <td className="px-4 py-3 text-gray-500">
                {job.createdAt ? new Date(job.createdAt).toLocaleString() : '—'}
              </td>
              <td className="px-4 py-3">
                {job.status === 'PENDING' && onCancelJob && (
                  <button
                    type="button"
                    disabled={cancellingId === job.id}
                    onClick={() => onCancelJob(job.id)}
                    className="text-xs font-medium text-red-700 hover:text-red-900 disabled:opacity-50"
                  >
                    {cancellingId === job.id ? 'Cancelling…' : 'Cancel'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
