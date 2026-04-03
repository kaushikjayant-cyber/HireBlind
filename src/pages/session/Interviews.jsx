import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarDays, Eye, EyeOff, Clock, AlertCircle, UserCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import Modal from '../../components/ui/Modal'

export default function Interviews() {
  const { id: sessionId } = useParams()
  const { user } = useAuthStore()
  const [shortlisted, setShortlisted] = useState([])
  const [slots, setSlots] = useState({})
  const [revealModal, setRevealModal] = useState(null)
  const [loading, setLoading] = useState(true)

  const candidateCodes = ['A', 'B', 'C', 'D', 'E']

  useEffect(() => {
    loadData()
  }, [sessionId])

  const loadData = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('resumes')
      .select('*')
      .eq('session_id', sessionId)
      .eq('is_shortlisted', true)
      .order('overall_score', { ascending: false })
    setShortlisted(data || [])

    const { data: interviewData } = await supabase
      .from('interview_slots')
      .select('*')
      .eq('session_id', sessionId)

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
  }

  const revealIdentity = async (candidate, code) => {
    const now = new Date().toISOString()
    await supabase.from('interview_slots').update({ revealed_at: now, revealed_by: user.id, status: 'revealed' })
      .eq('resume_id', candidate.id).eq('session_id', sessionId)
    await supabase.from('override_log').insert({
      resume_id: candidate.id,
      session_id: sessionId,
      original_rank: null,
      new_rank: null,
      reason: `Identity revealed for Candidate ${code}`,
      overridden_by: user.id,
      overridden_at: now,
    })
    setSlots((prev) => ({ ...prev, [candidate.id]: { ...prev[candidate.id], revealed_at: now } }))
    setRevealModal(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-gray-400">
      <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mr-3" />
      Loading shortlist...
    </div>
  )

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Blind Interview Scheduler</h1>
        <p className="text-sm text-gray-500 mt-1">Schedule interviews with shortlisted candidates. Identities remain hidden until you choose to reveal them.</p>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-3.5 flex items-center gap-3">
        <EyeOff className="w-5 h-5 text-indigo-500 flex-shrink-0" />
        <p className="text-sm text-indigo-700">
          <strong>Blind mode active.</strong> You are scheduling interviews without knowing candidate names. Reveal identity only after your decision.
        </p>
      </div>

      {shortlisted.length === 0 ? (
        <div className="card text-center py-16 border-dashed">
          <UserCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No shortlisted candidates yet</p>
          <p className="text-sm text-gray-400 mt-1">Top 5 candidates are automatically shortlisted after upload + scoring.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shortlisted.slice(0, 5).map((candidate, i) => {
            const code = candidateCodes[i]
            const slot = slots[candidate.id]
            const revealed = !!slot?.revealed_at

            return (
              <div key={candidate.id} className="card hover:shadow-md transition-all duration-200 animate-fade-in">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center font-bold text-indigo-700">
                    {code}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Candidate {code}</h3>
                    <p className="text-xs text-gray-400">Score: {candidate.overall_score}/100</p>
                  </div>
                  {revealed ? (
                    <span className="badge-amber ml-auto">
                      <Eye className="w-3 h-3" /> Identity Revealed
                    </span>
                  ) : (
                    <span className="badge-indigo ml-auto">Anonymous</span>
                  )}
                </div>

                {/* Time picker */}
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
                    Scheduled: {new Date(slot.scheduled_at).toLocaleString('nl-NL')}
                  </div>
                )}

                {!revealed ? (
                  <button
                    onClick={() => setRevealModal({ candidate, code })}
                    className="btn-secondary w-full justify-center text-amber-600 border-amber-200 hover:bg-amber-50"
                  >
                    <Eye className="w-4 h-4" />
                    Reveal Identity
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-xl p-3">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Revealed on {new Date(slot.revealed_at).toLocaleString('nl-NL')}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Reveal modal */}
      <Modal isOpen={!!revealModal} onClose={() => setRevealModal(null)} title="Reveal Identity?" size="sm">
        {revealModal && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                You are about to reveal the identity of <strong>Candidate {revealModal.code}</strong>. This action is <strong>permanent</strong> and will be recorded in the audit log.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRevealModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => revealIdentity(revealModal.candidate, revealModal.code)} className="btn-primary bg-amber-500 hover:bg-amber-600">
                <Eye className="w-4 h-4" />
                Reveal Identity
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
