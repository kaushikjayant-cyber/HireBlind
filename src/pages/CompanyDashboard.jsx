import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Users, Clock, CheckCircle, FolderOpen, ArrowRight, ShieldCheck, BarChart3, ChevronRight } from 'lucide-react'
import { useSessionStore } from '../store/sessionStore'

const statusConfig = {
  active: { label: 'Active Pipeline', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  closed: { label: 'Closed Session', color: 'bg-slate-50 text-slate-700 border-slate-200' },
}

function SessionRow({ session }) {
  const navigate = useNavigate()
  const cfg = statusConfig[session.status] || { label: session.status, color: 'bg-slate-50 text-slate-700 border-slate-200' }
  const date = new Date(session.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div
      onClick={() => navigate(`/session/${session.id}/results`)}
      className="bg-white border border-slate-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
    >
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-1">
          <span className={`text-[11px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded border ${cfg.color}`}>
            {cfg.label}
          </span>
          <span className="text-sm text-slate-500 font-medium whitespace-nowrap">Opened {date}</span>
        </div>
        <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
          {session.job_title}
        </h3>
      </div>

      <div className="flex items-center gap-8 text-sm pt-4 sm:pt-0 border-t sm:border-none border-slate-100">
        <div className="flex flex-col">
          <span className="text-slate-500 font-medium">Anonymised Candidates</span>
          <span className="text-slate-900 font-bold text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-400" />
            {session.resume_count || 0}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-slate-500 font-medium">Shortlisted</span>
          <span className="text-slate-900 font-bold text-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            {session.shortlisted_count || 0}
          </span>
        </div>
        <ChevronRight className="hidden sm:block w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-colors" />
      </div>
    </div>
  )
}

export default function CompanyDashboard() {
  const { sessions, loading, fetchSessions } = useSessionStore()

  useEffect(() => {
    fetchSessions()
  }, [])

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in py-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">HireBlind Recruiter ATS</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Active Hiring Pipelines</h1>
          <p className="text-slate-500 mt-1">Manage anonymised candidate screenings and shortlists.</p>
        </div>
        <Link to="/session/new" className="mt-4 md:mt-0 inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-md font-medium transition-colors shadow-sm text-sm">
          <Plus className="w-4 h-4" />
          Create New Pipeline
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Active Pipelines', value: sessions.filter((s) => s.status === 'active').length, icon: FolderOpen },
          { label: 'Total Candidates Screened', value: sessions.reduce((a, s) => a + (s.resume_count || 0), 0), icon: Users },
          { label: 'Total Shortlisted Candidates', value: sessions.reduce((a, s) => a + (s.shortlisted_count || 0), 0), icon: CheckCircle },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-sm font-semibold">{stat.label}</span>
              <stat.icon className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="py-12 text-center text-slate-500 font-medium">Loading pipelines...</div>
        ) : sessions.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-12 text-center">
            <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-1">No pipelines found</h3>
            <p className="text-slate-500 mb-6">Create your first hiring pipeline to start anonymously screening candidates.</p>
            <Link to="/session/new" className="inline-flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-900 px-4 py-2 rounded-md font-medium transition-colors shadow-sm text-sm">
              <Plus className="w-4 h-4" />
              Create Pipeline
            </Link>
          </div>
        ) : (
          sessions.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))
        )}
      </div>
    </div>
  )
}
