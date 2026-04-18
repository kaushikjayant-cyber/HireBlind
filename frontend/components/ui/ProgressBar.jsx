export function ScoreBar({ value, max = 100, color = 'indigo', label, sublabel }) {
  const pct = Math.round((value / max) * 100)
  const colorMap = {
    indigo: 'bg-indigo-500',
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  }
  return (
    <div>
      {(label || sublabel) && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-600">{label}</span>
          <span className="text-xs font-semibold text-gray-800">{value}/{max}</span>
        </div>
      )}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full progress-bar-animate ${colorMap[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function ProgressBar({ value, label, status }) {
  const statusColor = {
    done: 'bg-emerald-500',
    error: 'bg-red-500',
    processing: 'bg-indigo-500',
    uploading: 'bg-amber-400',
    queued: 'bg-gray-300',
  }
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-500">{label || `${value}%`}</span>
        <span className="text-xs text-gray-400">{value}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full progress-bar-animate ${statusColor[status] || 'bg-indigo-500'}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}
