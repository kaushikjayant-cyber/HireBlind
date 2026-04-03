import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Trophy, Star, ChevronUp, ChevronDown, AlertTriangle,
  BarChart2, UserCheck, Info, Shield, Eye, EyeOff,
  CheckCircle2, XCircle, Lock
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useSessionStore } from '../../store/sessionStore'
import { useAuthStore } from '../../store/authStore'
import { ScoreBar } from '../../components/ui/ProgressBar'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score) {
  if (score >= 70) return { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' }
  if (score >= 50) return { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' }
  return { text: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' }
}

// ─── Anonymized Candidate Card ────────────────────────────────────────────────
// CRITICAL: This component NEVER shows original_file_name, uploaded_by,
// or any other PII field. Only candidate code + anonymized scores are displayed.

function CandidateCard({
  candidate, rank,
  onMoveUp, onMoveDown, canMoveUp, canMoveDown,
  onReveal, revealedIdentity,
}) {
  const colors = scoreColor(candidate.overall_score)
  const breakdown = candidate.score_breakdown || { skills: 0, experience: 0, relevance: 0 }
  const tags = candidate.score_breakdown?.tags || []
  const details = candidate.score_breakdown?.details || {}
  const explanation = candidate.score_breakdown?.explanation || `Ranked #${rank} based on overall match score.`

  return (
    <div className={`bg-white rounded-2xl border-2 ${colors.border} p-5 animate-fade-in hover:shadow-md transition-all duration-200`}>
      <div className="flex items-start gap-4">

        {/* Rank badge + move controls */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${colors.bg} ${colors.text}`}>
            #{rank}
          </div>
          <button
            onClick={onMoveUp} disabled={!canMoveUp}
            title="Move up (requires reason)"
            className="text-gray-300 hover:text-indigo-500 disabled:opacity-0 transition-colors"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={onMoveDown} disabled={!canMoveDown}
            title="Move down (requires reason)"
            className="text-gray-300 hover:text-indigo-500 disabled:opacity-0 transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Main content — strictly anonymised */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {/* NEVER use candidate real name here — use code only */}
            <h3 className="font-bold text-gray-900">
              {revealedIdentity
                ? <span className="text-amber-700 flex items-center gap-1.5">
                    <Eye className="w-4 h-4" /> {revealedIdentity}
                  </span>
                : <span className="flex items-center gap-1.5">
                    <EyeOff className="w-3.5 h-3.5 text-indigo-400" /> Candidate #{rank}
                  </span>
              }
            </h3>
            {candidate.is_shortlisted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                <Star className="w-3 h-3" /> Shortlisted
              </span>
            )}
            {candidate.manually_adjusted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                <AlertTriangle className="w-3 h-3" /> Manually Adjusted
              </span>
            )}
            {revealedIdentity && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                <Eye className="w-3 h-3" /> Identity Revealed
              </span>
            )}
          </div>

          {/* Score bars — explainability */}
          <div className="space-y-2 mb-3">
            <ScoreBar value={breakdown.skills || 0} max={40} color="indigo" label="Skills Match" />
            <ScoreBar value={breakdown.experience || 0} max={30} color="green" label="Experience" />
            <ScoreBar value={breakdown.relevance || 0} max={30} color="amber" label="Role Relevance" />
          </div>

          {/* Matched skills tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* AI explanation */}
          <p className="text-xs text-gray-500 flex items-start gap-1">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-indigo-400" />
            {explanation}
          </p>

          {/* Experience detail */}
          {details.resume_years !== undefined && (
            <p className="text-xs text-gray-400 mt-1">
              Experience: <span className="font-medium text-gray-600">{details.resume_years} yr(s)</span>
              {details.required_years > 0 && ` · Required: ${details.required_years} yr(s)`}
            </p>
          )}
        </div>

        {/* Overall score circle */}
        <div className={`flex-shrink-0 text-center px-4 py-3 rounded-xl min-w-[80px] ${colors.bg}`}>
          <p className={`text-3xl font-extrabold ${colors.text}`}>{candidate.overall_score}</p>
          <p className="text-xs text-gray-400 font-medium">/ 100</p>
        </div>
      </div>

      {/* Reveal Identity CTA — only visible if NOT yet revealed and not shortlisted-during-eval */}
      {!revealedIdentity && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-indigo-500">
            <Lock className="w-3.5 h-3.5" />
            <span>Identity is hidden — evaluation is anonymous</span>
          </div>
          <button
            onClick={() => onReveal(candidate)}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            Reveal Identity
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Results Page ────────────────────────────────────────────────────────

export default function Results() {
  const { id: sessionId } = useParams()
  const navigate = useNavigate()
  const { fetchSession, currentSession } = useSessionStore()
  const { user } = useAuthStore()
  const toast = useToast()

  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [revealedMap, setRevealedMap] = useState({}) // resumeId → fileName

  // Override modal
  const [overrideModal, setOverrideModal] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [pendingMove, setPendingMove] = useState(null)
  const [overrideLoading, setOverrideLoading] = useState(false)

  // Reveal modal
  const [revealModal, setRevealModal] = useState(null) // candidate object
  const [revealLoading, setRevealLoading] = useState(false)
  const [revealConfirmText, setRevealConfirmText] = useState('')

  useEffect(() => {
    fetchSession(sessionId)
    loadCandidates()
  }, [sessionId])

  const loadCandidates = async () => {
    setLoading(true)
    // IMPORTANT: We select only non-PII fields for display.
    // original_file_name is fetched only AFTER explicit reveal action.
    const { data, error } = await supabase
      .from('resumes')
      .select('id, session_id, overall_score, score_breakdown, is_shortlisted, manually_adjusted, identity_revealed, identity_revealed_at, processing_status')
      .eq('session_id', sessionId)
      .order('overall_score', { ascending: false })

    if (error) {
      toast('Failed to load candidates: ' + error.message, 'error')
    } else {
      setCandidates(data || [])
      // Pre-populate already-revealed identities
      const alreadyRevealed = {}
      for (const r of (data || [])) {
        if (r.identity_revealed) {
          // Re-fetch the name for already-revealed ones
          fetchRevealedName(r.id, alreadyRevealed)
        }
      }
    }
    setLoading(false)
  }

  const fetchRevealedName = async (resumeId, mapRef) => {
    const { data } = await supabase
      .from('resumes')
      .select('original_file_name')
      .eq('id', resumeId)
      .single()
    if (data?.original_file_name) {
      setRevealedMap((prev) => ({ ...prev, [resumeId]: data.original_file_name }))
    }
  }

  // ── Override (manual ranking adjustment) ─────────────────────────────────
  const openOverride = (fromIndex, direction) => {
    const toIndex = fromIndex + direction
    if (toIndex < 0 || toIndex >= candidates.length) return
    setPendingMove({ fromIndex, toIndex })
    setOverrideModal(true)
    setOverrideReason('')
  }

  const confirmOverride = async () => {
    if (!pendingMove || !overrideReason.trim()) return
    setOverrideLoading(true)
    const { fromIndex, toIndex } = pendingMove
    const from = candidates[fromIndex]

    // Update list locally
    const newList = [...candidates]
    newList.splice(fromIndex, 1)
    newList.splice(toIndex, 0, { ...from, manually_adjusted: true })
    setCandidates(newList)

    // Log override
    await supabase.from('override_log').insert({
      resume_id: from.id,
      session_id: sessionId,
      original_rank: fromIndex + 1,
      new_rank: toIndex + 1,
      reason: overrideReason,
      overridden_by: user?.id,
      overridden_at: new Date().toISOString(),
    })
    await supabase.from('resumes').update({ manually_adjusted: true }).eq('id', from.id)

    setOverrideModal(false)
    setPendingMove(null)
    setOverrideLoading(false)
    toast('Override recorded in compliance log', 'warning')
  }

  // ── Reveal Identity ───────────────────────────────────────────────────────
  const openReveal = (candidate) => {
    setRevealModal(candidate)
    setRevealConfirmText('')
  }

  const confirmReveal = useCallback(async () => {
    if (!revealModal) return
    if (revealConfirmText.trim().toLowerCase() !== 'reveal') {
      toast('Type "reveal" to confirm', 'error')
      return
    }
    setRevealLoading(true)
    try {
      const userId = user?.id || ''
      // Call backend reveal endpoint (logs to identity_reveal_log)
      const res = await fetch(`/api/reveal-identity/${revealModal.id}`, {
        method: 'POST',
        headers: { 'X-User-Id': userId },
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Reveal failed')
      }
      const data = await res.json()
      const displayName = data.original_file_name || 'Unknown'
      setRevealedMap((prev) => ({ ...prev, [revealModal.id]: displayName }))
      // Update local candidate as revealed
      setCandidates((prev) =>
        prev.map((c) => c.id === revealModal.id ? { ...c, identity_revealed: true } : c)
      )
      setRevealModal(null)
      toast(`Identity revealed: ${displayName}`, 'warning')
    } catch (err) {
      toast('Reveal failed: ' + err.message, 'error')
    } finally {
      setRevealLoading(false)
    }
  }, [revealModal, revealConfirmText, user])

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mr-3" />
        Loading anonymised candidates…
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-slide-up">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ranked Candidates</h1>
          {currentSession && (
            <p className="text-gray-500 text-sm mt-1">
              {currentSession.job_title}
              <span className="ml-2 text-xs text-gray-400">· {candidates.length} candidate(s)</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/session/${sessionId}/compliance`)}
            className="btn-secondary"
          >
            <Shield className="w-4 h-4" />
            Compliance
          </button>
          <button
            onClick={() => navigate(`/session/${sessionId}/interviews`)}
            className="btn-secondary"
          >
            <UserCheck className="w-4 h-4" />
            Interviews
          </button>
        </div>
      </div>

      {/* Anonymity banner */}
      <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-3.5">
        <EyeOff className="w-5 h-5 text-indigo-500 flex-shrink-0" />
        <div>
          <p className="text-sm text-indigo-800 font-semibold">Blind Evaluation Mode Active</p>
          <p className="text-xs text-indigo-600 mt-0.5">
            All candidate identities are hidden. Rankings are based solely on skills, experience, and role relevance. 
            Use ↑↓ to reorder — every override is logged. Reveal identity only after your final decision.
          </p>
        </div>
      </div>

      {/* Candidates list */}
      {candidates.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
          <Trophy className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No candidates yet</p>
          <p className="text-sm text-gray-400 mt-1">Upload and process resumes to see ranked results.</p>
          <button
            onClick={() => navigate(`/session/${sessionId}/upload`)}
            className="btn-primary mx-auto mt-5"
          >
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
              onMoveUp={() => openOverride(i, -1)}
              onMoveDown={() => openOverride(i, 1)}
              canMoveUp={i > 0}
              canMoveDown={i < candidates.length - 1}
              onReveal={openReveal}
              revealedIdentity={revealedMap[c.id] || null}
            />
          ))}
        </div>
      )}

      {/* ── Override Modal ──────────────────────────────────────────────── */}
      <Modal
        isOpen={overrideModal}
        onClose={() => { setOverrideModal(false); setPendingMove(null) }}
        title="⚠️ Ranking Override Required"
      >
        {pendingMove && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-sm text-amber-800">
                You are moving <strong>Candidate #{pendingMove.fromIndex + 1}</strong> to position{' '}
                <strong>#{pendingMove.toIndex + 1}</strong>.
              </p>
              <p className="text-xs text-amber-600 mt-1">
                This action will be permanently recorded in the EU AI Act compliance audit log.
              </p>
            </div>

            {/* Show AI reasoning for current rank */}
            {candidates[pendingMove.fromIndex]?.score_breakdown?.tags?.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-600 mb-2">AI reasoning for current rank:</p>
                <div className="flex flex-wrap gap-1.5">
                  {candidates[pendingMove.fromIndex].score_breakdown.tags.map((tag, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="label">
                Reason for override <span className="text-red-400">*</span>
              </label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="input-field resize-none"
                rows={3}
                placeholder="e.g. Additional context from preliminary screening, specific project experience mentioned in cover letter…"
              />
              <p className="text-xs text-gray-400 mt-1">
                Logged with your user ID and timestamp in the compliance audit.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setOverrideModal(false); setPendingMove(null) }} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={confirmOverride}
                disabled={!overrideReason.trim() || overrideLoading}
                className="btn-primary bg-amber-500 hover:bg-amber-600"
              >
                {overrideLoading
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Logging…</>
                  : <><AlertTriangle className="w-4 h-4" /> Confirm Override</>
                }
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Reveal Identity Modal ───────────────────────────────────────── */}
      <Modal
        isOpen={!!revealModal}
        onClose={() => setRevealModal(null)}
        title="🔓 Reveal Candidate Identity"
        size="sm"
      >
        {revealModal && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-800">Anonymity will be broken</p>
                  <p className="text-sm text-red-700 mt-1">
                    You are about to reveal the identity of <strong>Candidate #{candidates.findIndex(c => c.id === revealModal.id) + 1}</strong>.
                    This action is <strong>permanent</strong> and will be logged in the compliance audit trail.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm text-gray-600">
              <p className="font-semibold text-gray-800">Before revealing, confirm:</p>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> Ranking is complete
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> Decision is based on merit only
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> You understand this is permanent
              </div>
            </div>

            <div>
              <label className="label">
                Type <strong>reveal</strong> to confirm
              </label>
              <input
                type="text"
                value={revealConfirmText}
                onChange={(e) => setRevealConfirmText(e.target.value)}
                className="input-field"
                placeholder="reveal"
                autoFocus
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setRevealModal(null)} className="btn-secondary">
                <XCircle className="w-4 h-4" /> Cancel
              </button>
              <button
                onClick={confirmReveal}
                disabled={revealConfirmText.trim().toLowerCase() !== 'reveal' || revealLoading}
                className="btn-primary bg-red-500 hover:bg-red-600"
              >
                {revealLoading
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Revealing…</>
                  : <><Eye className="w-4 h-4" /> Reveal Identity</>
                }
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
