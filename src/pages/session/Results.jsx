import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Trophy, Star, ChevronUp, ChevronDown, AlertTriangle,
  BarChart2, UserCheck, Info, Shield
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useSessionStore } from '../../store/sessionStore'
import { ScoreBar } from '../../components/ui/ProgressBar'
import Modal from '../../components/ui/Modal'

function scoreColor(score) {
  if (score >= 70) return { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' }
  if (score >= 50) return { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' }
  return { text: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100' }
}

function CandidateCard({ candidate, rank, onMoveUp, onMoveDown, canMoveUp, canMoveDown, isAdmin }) {
  const colors = scoreColor(candidate.overall_score)
  const breakdown = candidate.score_breakdown || { skills: 0, experience: 0, relevance: 0 }
  const tags = candidate.score_breakdown?.tags || []
  const explanation = candidate.score_breakdown?.explanation || `Ranked #${rank} based on overall match score.`

  return (
    <div className={`card border ${colors.border} animate-fade-in hover:shadow-md transition-all duration-200`}>
      <div className="flex items-start gap-4">
        {/* Rank + drag handle */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-1">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${colors.bg} ${colors.text}`}>
            #{rank}
          </div>
          <div className="flex flex-col gap-0.5">
            <button onClick={onMoveUp} disabled={!canMoveUp} className="text-gray-300 hover:text-indigo-500 disabled:opacity-0 transition-colors">
              <ChevronUp className="w-4 h-4" />
            </button>
            <button onClick={onMoveDown} disabled={!canMoveDown} className="text-gray-300 hover:text-indigo-500 disabled:opacity-0 transition-colors">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h3 className="font-semibold text-gray-900">Candidate #{rank}</h3>
            {candidate.is_shortlisted && (
              <span className="badge-green animate-pulse-soft">
                <Star className="w-3 h-3" /> Shortlisted
              </span>
            )}
            {candidate.manually_adjusted && (
              <span className="badge-amber">
                <AlertTriangle className="w-3 h-3" /> Manually Adjusted
              </span>
            )}
          </div>

          {/* Score bars */}
          <div className="space-y-2 mb-3">
            <ScoreBar value={breakdown.skills || 0} max={40} color="indigo" label="Skills Match" />
            <ScoreBar value={breakdown.experience || 0} max={30} color="green" label="Experience" />
            <ScoreBar value={breakdown.relevance || 0} max={30} color="amber" label="Role Relevance" />
          </div>

          {/* Explainability tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag, i) => (
                <span key={i} className="badge-indigo">{tag}</span>
              ))}
            </div>
          )}

          {/* Explanation */}
          <p className="text-xs text-gray-500 flex items-start gap-1">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-indigo-400" />
            {explanation}
          </p>
        </div>

        {/* Overall score */}
        <div className={`flex-shrink-0 text-center px-4 py-3 rounded-xl ${colors.bg}`}>
          <p className={`text-3xl font-bold ${colors.text}`}>{candidate.overall_score}</p>
          <p className="text-xs text-gray-400">/ 100</p>
        </div>
      </div>
    </div>
  )
}

export default function Results() {
  const { id: sessionId } = useParams()
  const navigate = useNavigate()
  const { fetchSession, currentSession } = useSessionStore()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [overrideModal, setOverrideModal] = useState(null)
  const [overrideReason, setOverrideReason] = useState('')
  const [overridePending, setOverridePending] = useState(null)

  useEffect(() => {
    fetchSession(sessionId)
    loadCandidates()
  }, [sessionId])

  const loadCandidates = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('resumes')
      .select('*')
      .eq('session_id', sessionId)
      .order('overall_score', { ascending: false })
    setCandidates(data || [])
    setLoading(false)
  }

  const handleMove = (index, direction) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= candidates.length) return
    setOverridePending({ fromIndex: index, toIndex: newIndex })
    setOverrideModal(true)
    setOverrideReason('')
  }

  const confirmOverride = async () => {
    if (!overridePending || !overrideReason.trim()) return
    const { fromIndex, toIndex } = overridePending
    const from = candidates[fromIndex]

    const newList = [...candidates]
    newList.splice(fromIndex, 1)
    newList.splice(toIndex, 0, { ...from, manually_adjusted: true })
    setCandidates(newList)

    await supabase.from('override_log').insert({
      resume_id: from.id,
      session_id: sessionId,
      original_rank: fromIndex + 1,
      new_rank: toIndex + 1,
      reason: overrideReason,
      overridden_at: new Date().toISOString(),
    })

    await supabase.from('resumes').update({ manually_adjusted: true }).eq('id', from.id)
    setOverrideModal(false)
    setOverridePending(null)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-gray-400">
      <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mr-3" />
      Loading candidates...
    </div>
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ranked Candidates</h1>
          {currentSession && <p className="text-gray-500 text-sm mt-1">{currentSession.job_title}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/session/${sessionId}/compliance`)} className="btn-secondary">
            <Shield className="w-4 h-4" />
            Compliance
          </button>
          <button onClick={() => navigate(`/session/${sessionId}/interviews`)} className="btn-secondary">
            <UserCheck className="w-4 h-4" />
            Interviews
          </button>
        </div>
      </div>

      {/* Human-in-the-loop banner */}
      <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-3.5">
        <BarChart2 className="w-5 h-5 text-indigo-500 flex-shrink-0" />
        <p className="text-sm text-indigo-700">
          <strong>AI ranks. You decide.</strong> No candidate is accepted or rejected automatically. Use the ↑↓ arrows to reorder — every override is logged.
        </p>
      </div>

      {/* Candidates */}
      {candidates.length === 0 ? (
        <div className="card text-center py-16 border-dashed">
          <Trophy className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No candidates yet</p>
          <p className="text-sm text-gray-400 mt-1">Upload resumes to see ranked results.</p>
          <button onClick={() => navigate(`/session/${sessionId}/upload`)} className="btn-primary mx-auto mt-4">
            Upload Resumes
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {candidates.map((c, i) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              rank={i + 1}
              onMoveUp={() => handleMove(i, -1)}
              onMoveDown={() => handleMove(i, 1)}
              canMoveUp={i > 0}
              canMoveDown={i < candidates.length - 1}
            />
          ))}
        </div>
      )}

      {/* Override modal */}
      <Modal isOpen={overrideModal} onClose={() => setOverrideModal(false)} title="⚠️ Ranking Override Detected">
        {overridePending && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              You are moving <strong>Candidate #{overridePending.fromIndex + 1}</strong> to position{' '}
              <strong>#{overridePending.toIndex + 1}</strong>.
            </p>
            {candidates[overridePending.fromIndex]?.score_breakdown?.tags?.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
                <p className="font-medium mb-1.5">AI reasoning for current rank:</p>
                <div className="flex flex-wrap gap-1.5">
                  {candidates[overridePending.fromIndex].score_breakdown.tags.map((tag, i) => (
                    <span key={i} className="badge-indigo">{tag}</span>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="label">Reason for override <span className="text-red-400">*</span></label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="input-field resize-none"
                rows={3}
                placeholder="e.g. Candidate showed stronger cultural fit during initial screening"
              />
              <p className="text-xs text-gray-400 mt-1">This will be recorded in the compliance audit log with your name and timestamp.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setOverrideModal(false)} className="btn-secondary">Cancel</button>
              <button
                onClick={confirmOverride}
                disabled={!overrideReason.trim()}
                className="btn-primary bg-amber-500 hover:bg-amber-600"
              >
                <AlertTriangle className="w-4 h-4" />
                Confirm Override
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
