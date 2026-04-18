import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarDays, Eye, EyeOff, Clock, AlertCircle, UserCheck, CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'

export default function Interviews() {
  const { id: sessionId } = useParams()
  const { user } = useAuthStore()
  const toast = useToast()
  const [shortlisted, setShortlisted] = useState([])
  const [slots, setSlots] = useState({})
  const [revealedMap, setRevealedMap] = useState({}) // resumeId → fileName
  const [revealModal, setRevealModal] = useState(null)
  const [revealConfirm, setRevealConfirm] = useState('')
  const [revealLoading, setRevealLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  const candidateCodes = ['A', 'B', 'C', 'D', 'E']

  useEffect(() => { loadData() }, [sessionId])

  const loadData = async () => {
    setLoading(true)
    // Fetch shortlisted resumes — NO PII fields selected
    const { data } = await supabase
      .from('resumes')
      .select('id, overall_score, is_shortlisted, score_breakdown, identity_revealed, identity_revealed_at')
      .eq('session_id', sessionId)
      .eq('is_shortlisted', true)
      .order('overall_score', { ascending: false })
    setShortlisted(data || [])

    // For already-revealed candidates, fetch their original filename
    for (const r of (data || [])) {
      if (r.identity_revealed) {
        const { data: full } = await supabase
          .from('resumes').select('original_file_name').eq('id', r.id).single()
        if (full?.original_file_name) {
          setRevealedMap((prev) => ({ ...prev, [r.id]: full.original_file_name }))
        }
      }
    }

    const { data: interviewData } = await supabase
      .from('interview_slots').select('*').eq('session_id', sessionId)
    const slotMap = {}
    interviewData?.forEach((s) => { slotMap[s.resume_id] = s })
    setSlots(slotMap)
    setLoading(false)
  }

  const saveSlot = async (resumeId, datetime, code) => {
    const existing = slots[resumeId]
    if (existing) {
      await supabase.from('interview_slots').update({ scheduled_at: datetime }).eq('id', existing.id)
    } else {
      await supabase.from('interview_slots').insert({
        session_id: sessionId,
        resume_id: resumeId,
        candidate_code: `Candidate ${code}`,
        scheduled_at: datetime,
        status: 'scheduled',
      })
    }
    setSlots((prev) => ({ ...prev, [resumeId]: { ...prev[resumeId], scheduled_at: datetime } }))
    toast('Interview slot saved', 'success')
  }

  const confirmReveal = async () => {
    if (!revealModal) return
    if (revealConfirm.trim().toLowerCase() !== 'reveal') {
      toast('Type "reveal" to confirm', 'error')
      return
    }
    setRevealLoading(true)
    try {
      const res = await fetch(`/api/reveal-identity/${revealModal.id}`, {
        method: 'POST',
        headers: { 'X-User-Id': user?.id || '' },
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Reveal failed')
      }
      const data = await res.json()
      const displayName = data.original_file_name || 'Unknown'

      // Update interview slot as revealed
      await supabase.from('interview_slots')
        .update({ revealed_at: data.revealed_at, revealed_by: user?.id, status: 'revealed' })
        .eq('resume_id', revealModal.id).eq('session_id', sessionId)

      setRevealedMap((prev) => ({ ...prev, [revealModal.id]: displayName }))
      setShortlisted((prev) =>
        prev.map((c) => c.id === revealModal.id ? { ...c, identity_revealed: true } : c)
      )
      setRevealModal(null)
      setRevealConfirm('')
      toast(`Identity revealed: ${displayName}`, 'warning')
    } catch (err) {
      toast('Reveal failed: ' + err.message, 'error')
    } finally {
      setRevealLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-gray-400">
      <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mr-3" />
      Loading shortlisted candidates…
    </div>
  )

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Blind Interview Scheduler</h1>
        <p className="text-sm text-gray-500 mt-1">
          Schedule interviews with shortlisted candidates. Identities remain hidden until you explicitly reveal them.
        </p>
      </div>

      {/* Anonymity banner */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-3.5 flex items-center gap-3">
        <EyeOff className="w-5 h-5 text-indigo-500 flex-shrink-0" />
        <p className="text-sm text-indigo-700">
          <strong>Blind mode active.</strong> You are scheduling interviews without seeing candidate names.
          Reveal identity only after scheduling decisions are confirmed.
        </p>
      </div>

      {shortlisted.length === 0 ? (
        <div className="bg-white rounded-2xl border-dashed border-2 border-gray-200 p-16 text-center">
          <UserCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No shortlisted candidates yet</p>
          <p className="text-sm text-gray-400 mt-1">Top 5 candidates are automatically shortlisted after upload and scoring.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shortlisted.slice(0, 5).map((candidate, i) => {
            const code = candidateCodes[i]
            const slot = slots[candidate.id]
            const revealedName = revealedMap[candidate.id]

            return (
              <div key={candidate.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-all animate-fade-in">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center font-bold text-indigo-700">
                    {code}
                  </div>
                  <div className="flex-1">
                    {revealedName ? (
                      <h3 className="font-semibold text-amber-700 flex items-center gap-1.5">
                        <Eye className="w-4 h-4" /> {revealedName}
                      </h3>
                    ) : (
                      <h3 className="font-semibold text-gray-900 flex items-center gap-1.5">
                        <EyeOff className="w-3.5 h-3.5 text-indigo-400" /> Candidate {code}
                      </h3>
                    )}
                    <p className="text-xs text-gray-400">Score: {candidate.overall_score}/100</p>
                  </div>
                  {revealedName ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                      <Eye className="w-3 h-3" /> Revealed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                      Anonymous
                    </span>
                  )}
                </div>

                {/* Interview time picker */}
                <div className="mb-3">
                  <label className="label">
                    <CalendarDays className="inline w-3.5 h-3.5 mr-1 mb-0.5 text-gray-400" />
                    Interview Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={slot?.scheduled_at ? slot.scheduled_at.slice(0, 16) : ''}
                    onChange={(e) => saveSlot(candidate.id, e.target.value, code)}
                    className="input-field"
                  />
                </div>

                {slot?.scheduled_at && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 mb-3">
                    <Clock className="w-3.5 h-3.5" />
                    Scheduled: {new Date(slot.scheduled_at).toLocaleString()}
                  </div>
                )}

                {!revealedName ? (
                  <button
                    onClick={() => { setRevealModal(candidate); setRevealConfirm('') }}
                    className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-4 py-2 rounded-xl transition-colors"
                  >
                    <Eye className="w-4 h-4" /> Reveal Identity
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-xl p-3">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Revealed — {candidate.identity_revealed_at
                      ? new Date(candidate.identity_revealed_at).toLocaleString()
                      : 'audit logged'}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Reveal Identity Modal */}
      <Modal isOpen={!!revealModal} onClose={() => setRevealModal(null)} title="🔓 Reveal Candidate Identity" size="sm">
        {revealModal && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">
                You are about to permanently reveal the identity of{' '}
                <strong>Candidate {candidateCodes[shortlisted.findIndex(c => c.id === revealModal.id)]}</strong>.
                This action is logged in the compliance audit trail.
              </p>
            </div>
            <div>
              <label className="label">Type <strong>reveal</strong> to confirm</label>
              <input
                type="text"
                value={revealConfirm}
                onChange={(e) => setRevealConfirm(e.target.value)}
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
                disabled={revealConfirm.trim().toLowerCase() !== 'reveal' || revealLoading}
                className="btn-primary bg-red-500 hover:bg-red-600"
              >
                {revealLoading
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Revealing…</>
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
