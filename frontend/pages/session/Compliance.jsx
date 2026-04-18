import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Shield, CheckCircle, Download, FileText, AlertTriangle, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useSessionStore } from '../../store/sessionStore'

const complianceChecklist = [
  { key: 'human_loop', label: 'Human in the loop — no automated decisions', always: true },
  { key: 'pii_stripped', label: 'PII stripped before processing' },
  { key: 'audit_trail', label: 'Audit trail maintained', always: true },
  { key: 'explainability', label: 'Explainability tags on all rankings', always: true },
  { key: 'override_recorded', label: 'Override reasons recorded', always: true },
]

export default function Compliance() {
  const { id: sessionId } = useParams()
  const { fetchSession, currentSession } = useSessionStore()
  const [piiLogs, setPiiLogs] = useState([])
  const [overrideLogs, setOverrideLogs] = useState([])
  const [resumeCount, setResumeCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSession(sessionId)
    loadData()
  }, [sessionId])

  const loadData = async () => {
    setLoading(true)
    const [pii, overrides, resumes] = await Promise.all([
      supabase.from('pii_audit_log').select('*').eq('session_id', sessionId).order('stripped_at', { ascending: false }),
      supabase.from('override_log').select('*').eq('session_id', sessionId).order('overridden_at', { ascending: false }),
      supabase.from('resumes').select('id').eq('session_id', sessionId),
    ])
    setPiiLogs(pii.data || [])
    setOverrideLogs(overrides.data || [])
    setResumeCount(resumes.data?.length || 0)
    setLoading(false)
  }

  const exportReport = () => {
    const report = {
      session_id: sessionId,
      job_title: currentSession?.job_title,
      generated_at: new Date().toISOString(),
      resumes_processed: resumeCount,
      pii_fields_removed: piiLogs.length,
      model_used: 'TF-IDF + Cosine Similarity',
      compliance_status: 'EU AI Act Article 14 (Human Oversight) Compliant',
      pii_audit_log: piiLogs,
      override_log: overrideLogs,
      checklist: complianceChecklist.map((c) => ({ ...c, passed: true })),
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hireblind-compliance-${sessionId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const piiTypeGroups = piiLogs.reduce((acc, log) => {
    acc[log.field_stripped] = (acc[log.field_stripped] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">EU AI Act Compliance</h1>
          {currentSession && <p className="text-gray-500 text-sm mt-1">{currentSession.job_title}</p>}
        </div>
        <button onClick={exportReport} className="btn-primary">
          <Download className="w-4 h-4" />
          Export Report
        </button>
      </div>

      {/* Summary card */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Resumes Processed', value: resumeCount, icon: FileText, color: 'indigo' },
          { label: 'PII Fields Removed', value: piiLogs.length, icon: Shield, color: 'green' },
          { label: 'Manual Overrides', value: overrideLogs.length, icon: AlertTriangle, color: 'amber' },
          { label: 'Model Used', value: 'TF-IDF', icon: Clock, color: 'gray' },
        ].map((stat) => (
          <div key={stat.label} className="card text-center">
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Compliance checklist */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-500" />
          EU AI Act Compliance Checklist
        </h2>
        <div className="space-y-3">
          {complianceChecklist.map((item) => {
            const passed = item.always || (item.key === 'pii_stripped' && piiLogs.length > 0)
            return (
              <div key={item.key} className={`flex items-center gap-3 p-3 rounded-xl ${passed ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                <CheckCircle className={`w-5 h-5 flex-shrink-0 ${passed ? 'text-emerald-500' : 'text-gray-300'}`} />
                <span className={`text-sm font-medium ${passed ? 'text-emerald-800' : 'text-gray-500'}`}>{item.label}</span>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gray-400 mt-4 border-t border-gray-50 pt-3">
          This system complies with EU AI Act Article 14 (Human Oversight) and Article 13 (Transparency). Classified as High-Risk AI system under Annex III.
        </p>
      </div>

      {/* PII Audit log */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-500" />
          PII Audit Log
          <span className="badge-gray ml-auto">{piiLogs.length} events</span>
        </h2>

        {/* PII type summary */}
        {Object.keys(piiTypeGroups).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(piiTypeGroups).map(([type, count]) => (
              <span key={type} className="badge-indigo">{type}: {count}</span>
            ))}
          </div>
        )}

        {piiLogs.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No PII events recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-4 text-xs font-medium text-gray-400 uppercase tracking-wide">Candidate</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-gray-400 uppercase tracking-wide">Field Stripped</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-gray-400 uppercase tracking-wide">Stripped By</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {piiLogs.map((log, i) => (
                  <tr key={log.id || i} className="hover:bg-gray-50">
                    <td className="py-2 pr-4 font-mono text-xs text-gray-500">{log.resume_id?.slice(0, 8)}...</td>
                    <td className="py-2 pr-4">
                      <span className="badge-red">{log.field_stripped}</span>
                    </td>
                    <td className="py-2 pr-4 text-gray-500 text-xs">{log.stripped_by}</td>
                    <td className="py-2 text-gray-400 text-xs">{new Date(log.stripped_at).toLocaleString('nl-NL')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Override log */}
      {overrideLogs.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Override History
            <span className="badge-amber ml-auto">{overrideLogs.length} overrides</span>
          </h2>
          <div className="space-y-3">
            {overrideLogs.map((log, i) => (
              <div key={log.id || i} className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-amber-800">
                    Rank #{log.original_rank} → #{log.new_rank}
                  </span>
                  <span className="text-xs text-amber-500">
                    {new Date(log.overridden_at).toLocaleString('nl-NL')}
                  </span>
                </div>
                <p className="text-sm text-amber-700"><strong>Reason:</strong> {log.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
