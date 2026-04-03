import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Users, Clock, CheckCircle, FolderOpen, ArrowRight, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

const statusConfig = {
  active: { label: 'Active', cls: 'badge-green' },
  closed: { label: 'Closed', cls: 'badge-gray' },
}

function SessionCard({ session }) {
  const navigate = useNavigate()
  const cfg = statusConfig[session.status] || { label: session.status, cls: 'badge-gray' }
  const date = new Date(session.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div
      className="card hover:shadow-md transition-all duration-200 cursor-pointer group animate-fade-in border-l-4 border-l-indigo-500"
      onClick={() => navigate(`/session/${session.id}/results`)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={cfg.cls}>{cfg.label}</span>
          </div>
          <h3 className="font-semibold text-gray-900 text-base group-hover:text-indigo-700 transition-colors truncate">
            {session.job_title}
          </h3>
          <p className="text-sm text-gray-400 mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {date}
          </p>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors mt-1 flex-shrink-0" />
      </div>

      <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-5 text-sm text-gray-500">
        <span className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          {session.resume_count || 0} resumes
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
          {session.shortlisted_count || 0} shortlisted
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Link
          to={`/session/${session.id}/upload`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-indigo-600 hover:underline font-medium"
        >
          Upload
        </Link>
        <span className="text-gray-200">·</span>
        <Link
          to={`/session/${session.id}/results`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-indigo-600 hover:underline font-medium"
        >
          Results
        </Link>
        <span className="text-gray-200">·</span>
        <Link
          to={`/session/${session.id}/compliance`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-indigo-600 hover:underline font-medium"
        >
          Compliance Log
        </Link>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { sessions, loading, fetchSessions } = useSessionStore()

  useEffect(() => {
    fetchSessions()
  }, [])

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-600" />
            Admin Overview
          </h1>
          <p className="text-gray-500 text-sm mt-1">System-wide monitoring and compliance checks</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Platform Sessions', value: sessions.length, icon: FolderOpen, color: 'indigo' },
          { label: 'Active Processing', value: sessions.filter((s) => s.status === 'active').length, icon: CheckCircle, color: 'emerald' },
          { label: 'Total Resumes Processed', value: sessions.reduce((a, s) => a + (s.resume_count || 0), 0), icon: Users, color: 'amber' },
        ].map((stat) => (
          <div key={stat.label} className="card border-t-4 border-t-indigo-500">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                stat.color === 'indigo' ? 'bg-indigo-100' : stat.color === 'emerald' ? 'bg-emerald-100' : 'bg-amber-100'
              }`}>
                <stat.icon className={`w-4 h-4 ${
                  stat.color === 'indigo' ? 'text-indigo-600' : stat.color === 'emerald' ? 'text-emerald-600' : 'text-amber-600'
                }`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sessions grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mr-3" />
          Loading platform data...
        </div>
      ) : sessions.length === 0 ? (
        <div className="card text-center py-16 border-dashed border-gray-200">
          <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-500">No sessions recorded on platform</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  )
}
