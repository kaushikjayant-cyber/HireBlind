import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import {
  FileText, Sparkles, UploadCloud, Target, BrainCircuit, Activity,
  CheckCircle2, AlertCircle, X, Play, TrendingUp, Clock, Tag, Briefcase, ArrowLeft
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'
import { supabase } from '../lib/supabase'
import { anonymiseResume, scoreResume } from '../lib/api'
import { useToast } from '../components/ui/Toast'

const ScoreRing = ({ score }) => {
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="relative w-20 h-20 mx-auto">
      <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
        <circle cx="20" cy="20" r="16" fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle
          cx="20" cy="20" r="16" fill="none"
          stroke={color} strokeWidth="4"
          strokeDasharray={`${(score / 100) * 100.53} 100.53`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-extrabold text-slate-800">{score}</span>
      </div>
    </div>
  )
}

export default function StudentDashboard() {
  const { user } = useAuthStore()
  const { sessions, fetchSessions, loading: loadingSessions } = useSessionStore()
  const toast = useToast()
  
  const [selectedJob, setSelectedJob] = useState(null)
  
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle') // idle | processing | done | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSessions()
  }, [])

  const onDrop = useCallback((accepted) => {
    if (accepted.length > 0) setFile(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 5 * 1024 * 1024,
    maxFiles: 1,
  })

  const analyzeResume = async () => {
    if (!file || !selectedJob) return
    setStatus('processing')
    setError('')
    setResult(null)
    try {
      const sessionId = selectedJob.id

      // Upload the raw resume to supabase storage first
      const uniqueId = Math.random().toString(36).slice(2)
      const path = `${sessionId}/${uniqueId}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('resumes').upload(path, file)
      if (uploadError) throw uploadError

      // Step 1: Anonymise
      const anon = await anonymiseResume(file, sessionId)

      // Step 2: Score against the EXACT job description
      const scored = await scoreResume({
        session_id: sessionId,
        resume_id: uniqueId,
        anonymised_text: anon.anonymised_text,
        job_description: selectedJob.job_description,
      })
      
      const scoreData = scored
      
      // Step 3: Insert into DB so recruiter can see it!
      const { error: insertError } = await supabase.from('resumes').insert({
        id: uniqueId,
        session_id: sessionId,
        uploaded_by: user.id,
        original_file_name: file.name,
        file_type: file.name.endsWith('.pdf') ? 'pdf' : 'docx',
        file_size: file.size,
        uploaded_at: new Date().toISOString(),
        processing_status: 'done',
        anonymised_content: anon.anonymised_text,
        score_breakdown: scoreData.score_breakdown,
        overall_score: scoreData.overall_score,
        is_shortlisted: false,
        identity_revealed: false,
      })
      
      if (insertError) throw insertError

      // Step 4: Log PII stripping
      if (anon.pii_found?.length) {
        const logs = anon.pii_found.map((p) => ({
          resume_id: uniqueId,
          session_id: sessionId,
          field_stripped: p.field,
          stripped_at: new Date().toISOString(),
          stripped_by: 'system',
        }))
        await supabase.from('pii_audit_log').insert(logs)
      }

      const breakdown = scoreData.score_breakdown || {}
      const details = breakdown.details || {}
      const matchedSkills = details.matched_skills || []

      const piiRemoved = (anon.pii_found || []).length
      const wordCount = anon.anonymised_text.split(/\s+/).length
      const hasEducation = /degree|bachelor|master|university|college|school/i.test(anon.anonymised_text)

      const suggestions = [
        matchedSkills.length < 3 && 'Add more technical skills relevant to the job description.',
        details.resume_years < 1 && 'List your experience with year ranges (e.g. "2022–2024") so ATS can detect tenure.',
        !hasEducation && 'Include your educational background with degree name.',
        wordCount < 200 && 'Your resume may be too brief — ATS systems expect at least 300–500 words.',
        piiRemoved > 0 && `✓ ${piiRemoved} PII field(s) (names, contacts, etc.) stripped safely before recruiter sees it.`,
      ].filter(Boolean)

      const analysisResult = {
        score: scored.overall_score,
        wordCount,
        piiRemoved,
        matchedSkills,
        missingSkills: [],
        breakdown,
        hasEducation,
        filename: file.name,
        analyzedAt: new Date().toISOString(),
        suggestions,
      }

      setResult(analysisResult)
      setStatus('done')
      toast("Application submitted successfully!", 'success')
      
    } catch (err) {
      console.error(err)
      const msg = err.message || 'Failed to analyze resume.'
      setError(msg)
      toast(msg, 'error')
      setStatus('error')
    }
  }

  const reset = () => {
    setFile(null)
    setStatus('idle')
    setResult(null)
    setError('')
  }
  
  if (!selectedJob) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in py-8 px-4">
        <div className="flex items-center gap-3 border-b pb-6">
          <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Available Jobs</h1>
            <p className="text-gray-500">Apply to open positions completely anonymously.</p>
          </div>
        </div>

        {loadingSessions ? (
          <div className="text-center py-20 text-gray-400">Loading jobs...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <Target className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-600">No active jobs found.</p>
            <p className="text-sm text-gray-400 mt-1">Check back later when companies post new roles.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessions.map(job => (
              <div key={job.id} onClick={() => setSelectedJob(job)} className="bg-white border rounded-xl p-5 hover:border-violet-300 hover:shadow-md cursor-pointer transition-all flex flex-col min-h-[160px]">
                <h3 className="font-bold text-lg text-gray-900">{job.job_title}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 mt-1 mb-4 flex-grow">{job.job_description}</p>
                <div className="flex items-center justify-between mt-auto">
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">Active</span>
                    <span className="text-sm text-violet-600 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                        Apply Now <ArrowRight className="w-4 h-4" />
                    </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in py-8 px-4">
      {/* Header Back Button */}
      <button onClick={() => { setSelectedJob(null); reset(); }} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to jobs
      </button>

      {/* Header */}
      <div className="flex flex-col items-center text-center bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-3xl p-10 border border-violet-100 shadow-sm relative overflow-hidden">
        <div className="bg-violet-100 text-violet-700 p-3 rounded-2xl mb-4">
          <BrainCircuit className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Apply for {selectedJob.job_title}</h1>
        <p className="text-gray-600 max-w-md mb-2">
          Upload your resume. The AI will remove all your personal data before the recruiter sees it.
        </p>
        <p className="text-xs text-violet-500 font-medium bg-violet-100 px-3 py-1.5 rounded-full">
          Bias-free selection — recruiters judge skills, not names.
        </p>
      </div>

      {/* Upload Section */}
      {status !== 'done' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-violet-600" />
            Upload Your Resume
          </h2>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
              isDragActive ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-violet-300 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud className={`w-10 h-10 mx-auto mb-3 ${isDragActive ? 'text-violet-500' : 'text-gray-300'}`} />
            <p className="font-semibold text-gray-700">
              {isDragActive ? 'Drop your resume here...' : 'Drag & drop your resume'}
            </p>
            <p className="text-sm text-gray-400 mt-1">PDF or DOCX · Max 5MB · Single file</p>
          </div>

          {file && (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-violet-100 bg-violet-50">
              <FileText className="w-5 h-5 text-violet-600 flex-shrink-0" />
              <span className="text-sm font-medium text-violet-800 truncate flex-1">{file.name}</span>
              <span className="text-xs text-violet-500">{(file.size / 1024).toFixed(0)} KB</span>
              <button onClick={reset} className="text-violet-400 hover:text-red-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={analyzeResume}
            disabled={!file || status === 'processing'}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-semibold py-3 px-6 rounded-xl inline-flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            {status === 'processing' ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting application securely...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Submit Application
              </>
            )}
          </button>
        </div>
      )}

      {/* Results */}
      {status === 'done' && result && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-gray-900 text-xl flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Application Submitted Successfully!
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Score */}
              <div className="flex flex-col items-center text-center p-4 bg-gray-50 rounded-xl">
                <p className="text-sm font-semibold text-gray-500 mb-3">ATS Match Score</p>
                <ScoreRing score={result.score} />
                <p className={`mt-3 text-sm font-semibold ${
                  result.score >= 75 ? 'text-emerald-600' : result.score >= 50 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {result.score >= 75 ? 'Excellent Match ✓' : result.score >= 50 ? 'Good Match' : 'Low Match'}
                </p>
              </div>

              {/* Metrics */}
              <div className="col-span-2 grid grid-cols-2 gap-4">
                {[
                  { label: 'Word Count', value: result.wordCount, good: result.wordCount >= 200, icon: FileText },
                  { label: 'Matched Skills', value: result.matchedSkills?.length > 0 ? `${result.matchedSkills.length} detected` : 'None found', good: result.matchedSkills?.length > 0, icon: Target },
                  { label: 'Experience', value: result.breakdown?.details?.resume_years > 0 ? `${result.breakdown.details.resume_years} yr(s)` : 'Not detected', good: result.breakdown?.details?.resume_years > 0, icon: Activity },
                  { label: 'Education', value: result.hasEducation ? 'Detected' : 'Not found', good: result.hasEducation, icon: TrendingUp },
                ].map((m) => (
                  <div key={m.label} className={`p-4 rounded-xl border ${m.good ? 'border-emerald-100 bg-emerald-50' : 'border-red-100 bg-red-50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <m.icon className={`w-4 h-4 ${m.good ? 'text-emerald-600' : 'text-red-500'}`} />
                      <p className="text-xs font-medium text-gray-500">{m.label}</p>
                    </div>
                    <p className={`font-bold text-sm ${m.good ? 'text-emerald-800' : 'text-red-700'}`}>{m.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Matched skills */}
            {result.matchedSkills?.length > 0 && (
              <div className="mt-6 pt-5 border-t border-gray-100">
                <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-emerald-500" /> Detected Skills
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.matchedSkills.map((s) => (
                     <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                       <CheckCircle2 className="w-3 h-3" /> {s}
                     </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Suggestions */}
          {result.suggestions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-600" />
                Application AI Feedback
              </h3>
              <ul className="space-y-3">
                {result.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      s.startsWith('✓') ? 'bg-emerald-100' : 'bg-amber-100'
                    }`}>
                      {s.startsWith('✓')
                        ? <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        : <AlertCircle className="w-3 h-3 text-amber-600" />
                      }
                    </div>
                    <p className="text-sm text-gray-700">{s}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
