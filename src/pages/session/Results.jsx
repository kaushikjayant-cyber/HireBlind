import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Trophy, Star, ChevronUp, ChevronDown, AlertTriangle,
  BarChart2, UserCheck, Info, Shield, Eye, EyeOff,
  CheckCircle2, XCircle, Lock, CalendarDays, Clock, RefreshCw
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useSessionStore } from '../../store/sessionStore'
import { useAuthStore } from '../../store/authStore'
import { ScoreBar } from '../../components/ui/ProgressBar'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { scoreResume, revealIdentity } from '../../lib/api'

// Alphabet labels — Candidate A, B, C, D, E…
const CANDIDATE_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T']

function getCandidateLabel(index) {
  return `Candidate ${CANDIDATE_CODES[index] || index + 1}`
}

function scoreColor(score) {
  if (score >= 70) return { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-200' }
  if (score >= 50) return { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', ring: 'ring-amber-200' }
  return { text: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200', ring: 'ring-red-100' }
}

// ─── Candidate Card ────────────────────────────────────────────────────────────
function CandidateCard({
  candidate, rank, label,
  onMoveUp, onMoveDown, canMoveUp, canMoveDown,
  onReveal, revealedIdentity, onSchedule, scheduledAt,
}) {
  const isTop5 = rank <= 5
  const colors = scoreColor(candidate.overall_score)
  const breakdown = candidate.score_breakdown || { skills: 0, experience: 0, relevance: 0 }
  const tags = candidate.score_breakdown?.tags || []
  const details = candidate.score_breakdown?.details || {}
  const explanation = candidate.score_breakdown?.explanation || `${label} ranked #${rank} based on overall match.`

  return (
    <div className={`bg-white rounded-2xl border-2 ${colors.border} p-5 animate-fade-in hover:shadow-md transition-all duration-200 relative`}>
      {/* Top 5 badge */}
      {isTop5 && (
        <div className="absolute -top-2.5 left-5 inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full uppercase tracking-wide">
          <Trophy className="w-2.5 h-2.5" /> Top {rank}
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Rank badge + move controls */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-2">
          <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center ${colors.bg} ${colors.text} shadow-sm`}>
            <span className="text-xs font-bold leading-tight">{CANDIDATE_CODES[rank - 1] || rank}</span>
            <span className="text-[9px] text-gray-400 font-medium leading-tight">#{rank}</span>
          </div>
          <button
            onClick={onMoveUp} disabled={!canMoveUp}
            title="Override ranking — move up"
            className="text-gray-300 hover:text-indigo-500 disabled:opacity-0 transition-colors"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={onMoveDown} disabled={!canMoveDown}
            title="Override ranking — move down"
            className="text-gray-300 hover:text-indigo-500 disabled:opacity-0 transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Main content — strictly anonymised, NEVER shows PII */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <h3 className="font-bold text-gray-900 text-lg">
              {revealedIdentity ? (
                <span className="text-amber-700 flex items-center gap-1.5">
                  <Eye className="w-4 h-4" /> {revealedIdentity}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <EyeOff className="w-3.5 h-3.5 text-indigo-400" />
                  {label}
                </span>
              )}
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
            {scheduledAt && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                <CalendarDays className="w-3 h-3" /> Interview Scheduled
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
          <p className={`text-3xl font-extrabold ${colors.text}`}>{Math.round(candidate.overall_score)}</p>
          <p className="text-xs text-gray-400 font-medium">/ 100</p>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 flex-wrap">
        {/* Schedule interview button */}
        <button
          onClick={() => onSchedule(candidate, rank, label)}
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border ${
            scheduledAt
              ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          {scheduledAt
            ? `Interview: ${new Date(scheduledAt).toLocaleDateString()}`
            : 'Schedule Interview'}
        </button>

        {/* Identity status / reveal */}
        {!revealedIdentity ? (
          <>
            <div className="flex items-center gap-1.5 text-xs text-indigo-500 ml-2">
              <Lock className="w-3.5 h-3.5" />
              <span>Identity hidden</span>
            </div>
            <button
              onClick={() => onReveal(candidate, rank, label)}
              className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              Reveal Identity
            </button>
          </>
        ) : (
          <div className="ml-auto inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg">
            <Eye className="w-3.5 h-3.5" /> Identity Revealed
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Results Page ─────────────────────────────────────────────────────────
export default function Results() {
  const { id: sessionId } = useParams()
  const navigate = useNavigate()
  const { fetchSession, currentSession } = useSessionStore()
  const { user } = useAuthStore()
  const toast = useToast()

  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [revealedMap, setRevealedMap] = useState({})   // resumeId → fileName
  const [scheduledMap, setScheduledMap] = useState({}) // resumeId → datetime

  // Override modal
  const [overrideModal, setOverrideModal] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [pendingMove, setPendingMove] = useState(null)
  const [overrideLoading, setOverrideLoading] = useState(false)

  // Reveal modal
  const [revealModal, setRevealModal] = useState(null) // { candidate, rank, label }
  const [rescoring, setRescoring] = useState(false)

  const hasZeroScores = candidates.some((c) => !c.overall_score || c.overall_score === 0)

  // Re-score all candidates that have score=0 (race condition fix for old records)
  const rescoreAll = async () => {
    setRescoring(true)
    toast('Re-scoring candidates…', 'info')

    // Fetch JD fresh from DB
    const { data: session } = await supabase
      .from('sessions').select('job_description').eq('id', sessionId).single()
    const jd = session?.job_description || 'general professional position'

    const toRescore = candidates.filter((c) => !c.overall_score || c.overall_score === 0)
    if (toRescore.length === 0) {
      toast('All candidates already have scores', 'info')
      setRescoring(false)
      return
    }

    let successCount = 0
    let failCount = 0

    for (const candidate of toRescore) {
      // Fetch anonymised content
      const { data: full } = await supabase
        .from('resumes').select('anonymised_content').eq('id', candidate.id).single()

      if (!full?.anonymised_content) {
        toast(`Candidate ${candidate.id.slice(0, 6)}: no text found (re-upload needed)`, 'warning')
        failCount++
        continue
      }

      try {
        const scoreData = await scoreResume({
          session_id: sessionId,
          resume_id: candidate.id,
          anonymised_text: full.anonymised_content,
          job_description: jd,
        })

        // Normalize the breakdown to ensure all keys exist
        const bd = scoreData.score_breakdown || {}
        const normalized = {
          skills:      bd.skills      ?? 0,
          experience:  bd.experience  ?? 0,
          relevance:   bd.relevance   ?? 0,
          tags:        Array.isArray(bd.tags) ? bd.tags : [],
          explanation: bd.explanation ?? '',
          details:     bd.details     ?? {},
        }

        // Update DB
        await supabase.from('resumes').update({
          overall_score:    scoreData.overall_score,
          score_breakdown:  normalized,
          processing_status: 'done',
        }).eq('id', candidate.id)

        // Update UI state directly — no need for a full DB re-fetch
        setCandidates((prev) => prev.map((c) =>
          c.id === candidate.id
            ? { ...c, overall_score: scoreData.overall_score, score_breakdown: normalized }
            : c
        ))
        successCount++
      } catch (err) {
        console.error('Re-score failed for', candidate.id, err)
        failCount++
        toast(`Score failed: ${err.message?.slice(0, 80)}`, 'error')
      }
    }

    setRescoring(false)
    toast('Re-scoring complete—reloading results…', 'success')
    loadCandidates()
  }

  const [revealLoading, setRevealLoading] = useState(false)
  const [revealConfirmText, setRevealConfirmText] = useState('')

  // Schedule modal
  const [scheduleModal, setScheduleModal] = useState(null) // { candidate, rank, label }
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleLoading, setScheduleLoading] = useState(false)

  useEffect(() => {
    fetchSession(sessionId)
    loadCandidates()
    loadSchedules()
  }, [sessionId])

  const loadCandidates = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('resumes')
      .select('id, session_id, overall_score, score_breakdown, is_shortlisted, manually_adjusted, identity_revealed, identity_revealed_at, processing_status')
      .eq('session_id', sessionId)
      .order('overall_score', { ascending: false })

    if (error) {
      toast('Failed to load candidates: ' + error.message, 'error')
    } else {
      // Normalize score_breakdown — Supabase JSONB can return string in some versions
      const normalized = (data || []).map((r) => {
        let bd = r.score_breakdown
        if (typeof bd === 'string') {
          try { bd = JSON.parse(bd) } catch { bd = null }
        }
        return {
          ...r,
          overall_score: Number(r.overall_score) || 0,
          score_breakdown: {
            skills:      bd?.skills      ?? 0,
            experience:  bd?.experience  ?? 0,
            relevance:   bd?.relevance   ?? 0,
            tags:        Array.isArray(bd?.tags) ? bd.tags : [],
            explanation: bd?.explanation ?? '',
            details:     bd?.details     ?? {},
          },
        }
      })
      setCandidates(normalized)

      // Pre-load already-revealed identities — show clean display name
      for (const r of normalized) {
        if (r.identity_revealed) {
          const { data: full } = await supabase.from('resumes')
            .select('original_file_name').eq('id', r.id).single()
          if (full?.original_file_name) {
            let name = full.original_file_name
            for (const ext of ['.pdf', '.docx', '.doc', '.txt']) {
              if (name.toLowerCase().endsWith(ext)) name = name.slice(0, -ext.length)
            }
            name = name.replace(/[_-]/g, ' ').trim() || full.original_file_name
            setRevealedMap((prev) => ({ ...prev, [r.id]: name }))
          }
        }
      }
    }
    setLoading(false)
  }


  const loadSchedules = async () => {
    const { data } = await supabase
      .from('interview_slots')
      .select('resume_id, scheduled_at')
      .eq('session_id', sessionId)
    if (data) {
      const m = {}
      data.forEach((s) => { m[s.resume_id] = s.scheduled_at })
      setScheduledMap(m)
    }
  }

  // ── Override ────────────────────────────────────────────────────────────────
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
      overridden_by: user?.id,
      overridden_at: new Date().toISOString(),
    })
    await supabase.from('resumes').update({ manually_adjusted: true }).eq('id', from.id)
    setOverrideModal(false)
    setPendingMove(null)
    setOverrideLoading(false)
    toast('Override recorded in compliance log', 'warning')
  }

  // ── Reveal Identity ─────────────────────────────────────────────────────────
  const openReveal = (candidate, rank, label) => {
    setRevealModal({ candidate, rank, label })
    setRevealConfirmText('')
  }

  const confirmReveal = useCallback(async () => {
    if (!revealModal) return
    if (revealConfirmText.trim().toLowerCase() !== 'reveal') {
      toast('Type "reveal" to confirm', 'error'); return
    }
    setRevealLoading(true)
    try {
      // Use the typed api.js function — sends X-User-Id header correctly
      const data = await revealIdentity(revealModal.candidate.id)
      // Use display_name (extension stripped) or fallback to original_file_name
      const displayName = data.display_name || data.original_file_name || 'Unknown'
      setRevealedMap((prev) => ({ ...prev, [revealModal.candidate.id]: displayName }))
      setCandidates((prev) =>
        prev.map((c) => c.id === revealModal.candidate.id ? { ...c, identity_revealed: true } : c)
      )
      setRevealModal(null)
      toast(`🔓 Identity revealed: ${displayName}`, 'warning')
    } catch (err) {
      // Surface the actual backend error message
      const msg = err.message || 'Reveal failed'
      if (msg.includes('403')) {
        toast('Access denied — Recruiter role required', 'error')
      } else if (msg.includes('401')) {
        toast('Not authenticated — please log in again', 'error')
      } else if (msg.includes('404')) {
        toast('Resume not found in database', 'error')
      } else {
        toast('Reveal failed: ' + msg, 'error')
      }
    } finally {
      setRevealLoading(false)
    }
  }, [revealModal, revealConfirmText, user])

  // ── Schedule Interview ──────────────────────────────────────────────────────
  const openSchedule = (candidate, rank, label) => {
    setScheduleModal({ candidate, rank, label })
    setScheduleDate(scheduledMap[candidate.id]?.slice(0, 16) || '')
  }

  const confirmSchedule = async () => {
    if (!scheduleModal || !scheduleDate) return
    setScheduleLoading(true)
    const existing = scheduledMap[scheduleModal.candidate.id]
    if (existing) {
      await supabase.from('interview_slots')
        .update({ scheduled_at: scheduleDate })
        .eq('resume_id', scheduleModal.candidate.id)
        .eq('session_id', sessionId)
    } else {
      await supabase.from('interview_slots').insert({
        session_id: sessionId,
        resume_id: scheduleModal.candidate.id,
        candidate_code: scheduleModal.label,
        scheduled_at: scheduleDate,
        status: 'scheduled',
      })
    }
    setScheduledMap((prev) => ({ ...prev, [scheduleModal.candidate.id]: scheduleDate }))
    setScheduleLoading(false)
    setScheduleModal(null)
    toast(`Interview scheduled for ${scheduleModal.label}`, 'success')
  }

  // ───────────────────────────────────────────────────────────────────────────

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" /> Ranked Candidates
          </h1>
          {currentSession && (
            <p className="text-gray-500 text-sm mt-1">
              {currentSession.job_title}
              <span className="ml-2 text-xs text-gray-400">· {candidates.length} candidate(s)</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/session/${sessionId}/upload`)} className="btn-secondary">
            <BarChart2 className="w-4 h-4" /> Upload More
          </button>
          <button onClick={() => navigate(`/session/${sessionId}/compliance`)} className="btn-secondary">
            <Shield className="w-4 h-4" /> Compliance
          </button>
          <button onClick={() => navigate(`/session/${sessionId}/interviews`)} className="btn-secondary">
            <UserCheck className="w-4 h-4" /> All Interviews
          </button>
        </div>
      </div>

      {/* Anonymity banner */}
      <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-3.5">
        <EyeOff className="w-5 h-5 text-indigo-500 flex-shrink-0" />
        <div>
          <p className="text-sm text-indigo-800 font-semibold">Blind Evaluation Mode Active</p>
          <p className="text-xs text-indigo-600 mt-0.5">
            Candidates are shown as <strong>Candidate A, B, C…</strong> — no names, emails, or universities visible.
            Rankings are based on skills, experience, and role relevance. Override with reason → logged. Reveal only after final decision.
          </p>
        </div>
      </div>

      {/* Re-score warning — shown when scores are missing (race condition on old uploads) */}
      {hasZeroScores && candidates.length > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-amber-800 font-semibold">Scores Missing</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Some candidates show 0 scores. This happens when resumes were uploaded before the
              job description loaded. Click Re-score to fix without re-uploading.
            </p>
          </div>
          <button
            onClick={rescoreAll}
            disabled={rescoring}
            className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-4 py-2 rounded-xl transition-colors"
          >
            {rescoring ? (
              <><span className="w-3.5 h-3.5 border-2 border-amber-400/30 border-t-amber-600 rounded-full animate-spin" /> Scoring…</>
            ) : (
              <><RefreshCw className="w-3.5 h-3.5" /> Re-score All</>
            )}
          </button>
        </div>
      )}

      {/* Top 5 summary strip */}
      {candidates.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {candidates.slice(0, 5).map((c, i) => {
            const col = scoreColor(c.overall_score)
            return (
              <div key={c.id} className={`rounded-xl border p-3 text-center ${col.bg} ${col.border}`}>
                <p className="text-xs font-bold text-gray-500 mb-1">#{i + 1}</p>
                <p className={`text-xl font-extrabold ${col.text}`}>
                  {CANDIDATE_CODES[i]}
                </p>
                <p className={`text-sm font-bold ${col.text}`}>{Math.round(c.overall_score)}</p>
                <p className="text-[10px] text-gray-400">/ 100</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Candidates list */}
      {candidates.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
          <Trophy className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No candidates yet</p>
          <p className="text-sm text-gray-400 mt-1">Upload and process resumes to see ranked results.</p>
          <button onClick={() => navigate(`/session/${sessionId}/upload`)} className="btn-primary mx-auto mt-5">
            Upload Resumes
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {candidates.map((c, i) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              rank={i + 1}
              label={getCandidateLabel(i)}
              onMoveUp={() => openOverride(i, -1)}
              onMoveDown={() => openOverride(i, 1)}
              canMoveUp={i > 0}
              canMoveDown={i < candidates.length - 1}
              onReveal={openReveal}
              revealedIdentity={revealedMap[c.id] || null}
              onSchedule={openSchedule}
              scheduledAt={scheduledMap[c.id] || null}
            />
          ))}
        </div>
      )}

      {/* ── Override Modal ─────────────────────────────────────────────────── */}
      <Modal
        isOpen={overrideModal}
        onClose={() => { setOverrideModal(false); setPendingMove(null) }}
        title="⚠️ Ranking Override Required"
      >
        {pendingMove && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-sm text-amber-800">
                Moving <strong>{getCandidateLabel(pendingMove.fromIndex)}</strong> to position{' '}
                <strong>#{pendingMove.toIndex + 1}</strong>.
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Permanently recorded in compliance audit log.
              </p>
            </div>
            {candidates[pendingMove.fromIndex]?.score_breakdown?.tags?.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-600 mb-2">AI reasoning:</p>
                <div className="flex flex-wrap gap-1.5">
                  {candidates[pendingMove.fromIndex].score_breakdown.tags.map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700">{tag}</span>
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
                placeholder="e.g. Additional domain expertise identified from cover letter…"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setOverrideModal(false); setPendingMove(null) }} className="btn-secondary">Cancel</button>
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

      {/* ── Reveal Identity Modal ──────────────────────────────────────────── */}
      <Modal
        isOpen={!!revealModal}
        onClose={() => setRevealModal(null)}
        title="🔓 Reveal Candidate Identity"
        size="sm"
      >
        {revealModal && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-800">Anonymity will be broken</p>
                <p className="text-sm text-red-700 mt-1">
                  You are revealing <strong>{revealModal.label}</strong> (Rank #{revealModal.rank}).
                  This is <strong>permanent</strong> and logged in the compliance audit trail.
                </p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm text-gray-600">
              <p className="font-semibold text-gray-800">Confirm before revealing:</p>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> Ranking is final</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> Decision based on skills only</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> You understand this is permanent</div>
            </div>
            <div>
              <label className="label">Type <strong>reveal</strong> to confirm</label>
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

      {/* ── Schedule Interview Modal ───────────────────────────────────────── */}
      <Modal
        isOpen={!!scheduleModal}
        onClose={() => setScheduleModal(null)}
        title="📅 Schedule Interview"
        size="sm"
      >
        {scheduleModal && (
          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center font-bold text-indigo-700 text-lg">
                {CANDIDATE_CODES[scheduleModal.rank - 1]}
              </div>
              <div>
                <p className="font-semibold text-indigo-900">{scheduleModal.label}</p>
                <p className="text-xs text-indigo-600">Score: {Math.round(scheduleModal.candidate.overall_score)}/100 · Rank #{scheduleModal.rank}</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-xs text-amber-800 flex items-center gap-1.5">
                <EyeOff className="w-3.5 h-3.5" />
                Identity remains hidden until you explicitly reveal it. Interview is scheduled anonymously.
              </p>
            </div>

            <div>
              <label className="label">
                <CalendarDays className="inline w-3.5 h-3.5 mr-1 mb-0.5 text-gray-400" />
                Interview Date & Time
              </label>
              <input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="input-field"
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>

            {scheduleDate && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2">
                <Clock className="w-4 h-4" />
                {new Date(scheduleDate).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={() => setScheduleModal(null)} className="btn-secondary">Cancel</button>
              <button
                onClick={confirmSchedule}
                disabled={!scheduleDate || scheduleLoading}
                className="btn-primary"
              >
                {scheduleLoading
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                  : <><CalendarDays className="w-4 h-4" /> Confirm Schedule</>
                }
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
