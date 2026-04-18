import { useEffect, useState } from 'react'
import { ShieldCheck, Users, Activity, Settings, BarChart3, Clock, AlertTriangle, CheckCircle2, Eye } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

export default function AdminDashboard() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState({ users: 0, sessions: 0, resumes: 0, recruiters: 0, admins: 0 })
  const [recentUsers, setRecentUsers] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [revealLogs, setRevealLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAdminData()
  }, [])

  const fetchAdminData = async () => {
    setLoading(true)
    try {
      const [usersRes, sessionsRes, resumesRes, auditRes, revealRes] = await Promise.all([
        supabase.from('users').select('*').order('created_at', { ascending: false }),
        supabase.from('sessions').select('id').eq('status', 'active'),
        supabase.from('resumes').select('id'),
        supabase.from('pii_audit_log').select('*').order('stripped_at', { ascending: false }).limit(10),
        supabase.from('identity_reveal_log').select('*').order('revealed_at', { ascending: false }).limit(5),
      ])

      const users = usersRes.data || []
      setRecentUsers(users.slice(0, 5))
      setAuditLogs(auditRes.data || [])
      setRevealLogs(revealRes.data || [])
      setStats({
        users: users.length,
        sessions: (sessionsRes.data || []).length,
        resumes: (resumesRes.data || []).length,
        recruiters: users.filter(u => u.role === 'recruiter').length,
        admins: users.filter(u => u.role === 'admin').length,
      })
    } catch (err) {
      console.error('Admin data fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in py-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">System Administration</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Admin Control Panel</h1>
          <p className="text-slate-500 mt-1">Monitor platform activity, manage users, and enforce compliance.</p>
        </div>
        <Link
          to="/admin/settings"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm"
        >
          <Settings className="w-4 h-4" />
          Platform Settings
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: stats.users, icon: Users, color: 'indigo' },
          { label: 'Active Sessions', value: stats.sessions, icon: Activity, color: 'emerald' },
          { label: 'Resumes Processed', value: stats.resumes, icon: BarChart3, color: 'amber' },
          { label: 'Recruiters', value: stats.recruiters, icon: ShieldCheck, color: 'blue' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wide">{stat.label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                stat.color === 'indigo' ? 'bg-indigo-100' :
                stat.color === 'emerald' ? 'bg-emerald-100' :
                stat.color === 'amber' ? 'bg-amber-100' : 'bg-blue-100'
              }`}>
                <stat.icon className={`w-4 h-4 ${
                  stat.color === 'indigo' ? 'text-indigo-600' :
                  stat.color === 'emerald' ? 'text-emerald-600' :
                  stat.color === 'amber' ? 'text-amber-600' : 'text-blue-600'
                }`} />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-slate-900">{loading ? '—' : stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            Recent Registrations
          </h2>
          {loading ? (
            <div className="flex justify-center py-6 text-slate-400">
              <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : recentUsers.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No users yet.</p>
          ) : (
            <div className="space-y-3">
              {recentUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-indigo-700">{u.email?.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800 truncate max-w-[180px]">{u.email}</p>
                      <p className="text-xs text-slate-400">{new Date(u.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                    u.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                    'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Link to="/admin/settings" className="text-xs text-indigo-600 hover:underline font-medium mt-4 inline-block">
            Manage all users →
          </Link>
        </div>

        {/* PII Audit Log */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            PII Audit Log
            <span className="ml-auto text-xs text-slate-400 font-normal">Last 10 entries</span>
          </h2>
          {loading ? (
            <div className="flex justify-center py-6 text-slate-400">
              <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-slate-500 text-sm font-medium">No PII audit events yet.</p>
              <p className="text-slate-400 text-xs mt-1">Events are logged when PII is stripped from resumes.</p>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-64">
              {auditLogs.map((log, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      <span className="text-amber-600">{log.field_stripped}</span> stripped
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {log.stripped_at ? new Date(log.stripped_at).toLocaleString() : 'Unknown time'}
                      {' · by '}{log.stripped_by || 'system'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Identity Reveal Log */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5 text-rose-500" />
          Identity Reveal Log
          <span className="ml-auto text-xs text-slate-400 font-normal">Last 5 reveals</span>
        </h2>
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : revealLogs.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-4">No identity reveals yet.</p>
        ) : (
          <div className="space-y-2">
            {revealLogs.map((log, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                  <Eye className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">Resume <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">{log.resume_id?.slice(0, 8)}…</code> identity revealed</p>
                  <p className="text-xs text-slate-400">
                    {log.revealed_at ? new Date(log.revealed_at).toLocaleString() : '—'} · by {log.revealed_by || 'unknown'}
                  </p>
                </div>
                {log.already_revealed && (
                  <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">Re-revealed</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Platform Role Summary */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-6">
        <h3 className="font-bold text-indigo-800 mb-3 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" /> Platform Role Distribution
        </h3>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-2xl font-extrabold text-indigo-700">{stats.admins}</p>
            <p className="text-xs text-indigo-500 font-medium mt-1">Admins</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-blue-700">{stats.recruiters}</p>
            <p className="text-xs text-blue-500 font-medium mt-1">Recruiters</p>
          </div>
        </div>
      </div>
    </div>
  )
}
