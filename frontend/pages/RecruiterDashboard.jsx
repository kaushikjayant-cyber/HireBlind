import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus, Users, Clock, CheckCircle, FolderOpen, ArrowRight,
  Briefcase, UploadCloud, BarChart3, ChevronRight, Sparkles, ShieldCheck
} from 'lucide-react'
import { useSessionStore } from '../store/sessionStore'

const statusConfig = {
  active: { label: 'Active Pipeline', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  closed: { label: 'Closed', color: 'bg-slate-50 text-slate-700 border-slate-200' },
}

function SessionRow({ session }) {
  const navigate = useNavigate()
  const cfg = statusConfig[session.status] || { label: session.status, color: 'bg-slate-50 text-slate-700 border-slate-200' }
  const date = new Date(session.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div
      onClick={() => navigate(`/session/${session.id}/results`)}
      className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
    >
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-1">
          <span className={`text-[11px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded border ${cfg.color}`}>
            {cfg.label}
          </span>
          <span className="text-sm text-slate-500 font-medium whitespace-nowrap flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> {date}
          </span>
        </div>
        <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
          {session.job_title}
        </h3>
      </div>

      <div className="flex items-center gap-6 text-sm pt-4 sm:pt-0 border-t sm:border-none border-slate-100">
        <div className="flex flex-col items-center">
          <span className="text-slate-500 text-xs font-medium">Candidates</span>
          <span className="text-slate-900 font-bold text-lg flex items-center gap-1">
            <Users className="w-4 h-4 text-slate-400" />
            {session.resume_count || 0}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-slate-500 text-xs font-medium">Shortlisted</span>
          <span className="text-slate-900 font-bold text-lg flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            {session.shortlisted_count || 0}
          </span>
        </div>
        <div className="hidden sm:flex flex-col items-center gap-2">
          <Link
            to={`/session/${session.id}/upload`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-1"
          >
            <UploadCloud className="w-3 h-3" /> Upload Resumes
          </Link>
          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-colors" />
        </div>
      </div>
    </div>
  )
}

export default function RecruiterDashboard() {
  const { sessions, loading, fetchSessions } = useSessionStore()

  useEffect(() => {
    fetchSessions()
  }, [])

  const activeSessions = sessions.filter((s) => s.status === 'active')
  const totalCandidates = sessions.reduce((a, s) => a + (s.resume_count || 0), 0)
  const totalShortlisted = sessions.reduce((a, s) => a + (s.shortlisted_count || 0), 0)

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Recruiter Dashboard</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Hiring Pipelines</h1>
          <p className="text-slate-500 mt-1">Create job descriptions, upload candidate resumes, and view anonymised rankings.</p>
        </div>
        <Link
          to="/session/new"
          className="mt-4 md:mt-0 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors shadow-sm text-sm"
        >
          <Plus className="w-4 h-4" />
          New Job Description
        </Link>
      </div>

      {/* Anonymity Notice */}
      <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-3">
        <ShieldCheck className="w-5 h-5 text-indigo-500 flex-shrink-0" />
        <p className="text-sm text-indigo-800">
          <strong>Blind Evaluation Active:</strong> All candidate identities are hidden. You will only see anonymised resumes ranked by skills, experience, and relevance — never names, emails, or universities.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/session/new"
          className="flex items-center gap-4 bg-blue-50 border border-blue-100 rounded-xl p-5 hover:bg-blue-100 hover:border-blue-300 transition-all group"
        >
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <FolderOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-blue-900 group-hover:text-blue-800">New Job Description</p>
            <p className="text-xs text-blue-600 mt-0.5">Create a new hiring pipeline</p>
          </div>
          <ArrowRight className="w-4 h-4 text-blue-400 ml-auto group-hover:translate-x-1 transition-transform" />
        </Link>

        <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl p-5">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <UploadCloud className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">Bulk Resume Upload</p>
            <p className="text-xs text-slate-500 mt-0.5">Upload up to 20 resumes per session</p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl p-5">
          <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">AI Ranking</p>
            <p className="text-xs text-slate-500 mt-0.5">Anonymised candidate scoring + explainability</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Active Pipelines', value: activeSessions.length, icon: FolderOpen, color: 'blue' },
          { label: 'Candidates Screened', value: totalCandidates, icon: Users, color: 'slate' },
          { label: 'Shortlisted', value: totalShortlisted, icon: CheckCircle, color: 'emerald' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-sm font-semibold">{stat.label}</span>
              <stat.icon className={`w-5 h-5 ${
                stat.color === 'blue' ? 'text-blue-400' :
                stat.color === 'emerald' ? 'text-emerald-500' : 'text-slate-400'
              }`} />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Pipeline List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-lg">All Pipelines</h2>
          {sessions.length > 0 && (
            <span className="text-sm text-slate-400">{sessions.length} total</span>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 font-medium">
            <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
            Loading pipelines...
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-12 text-center">
            <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-1">No pipelines yet</h3>
            <p className="text-slate-500 mb-6">Create your first job description to start screening candidates anonymously.</p>
            <Link
              to="/session/new"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Job Description
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
