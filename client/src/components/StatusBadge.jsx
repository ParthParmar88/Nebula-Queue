const styles = {
  PENDING: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
  PROCESSING: 'bg-blue-100 text-blue-800 border border-blue-300',
  COMPLETED: 'bg-green-100 text-green-800 border border-green-300',
  FAILED: 'bg-red-100 text-red-800 border border-red-300',
  CANCELLED: 'bg-gray-100 text-gray-700 border border-gray-300',
}

const icons = {
  PENDING: '●',
  PROCESSING: '◆',
  COMPLETED: '✓',
  FAILED: '✕',
  CANCELLED: '○',
}

export default function StatusBadge({ status }) {
  const cls = styles[status] || 'bg-gray-100 text-gray-800 border border-gray-200'
  const icon = icons[status] || '·'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${cls}`}>
      <span className="opacity-70">{icon}</span>
      {status}
    </span>
  )
}
