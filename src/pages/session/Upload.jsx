import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import {
  Upload as UploadIcon, FileText, X, CheckCircle, AlertCircle,
  Play, File, ShieldCheck, ArrowRight, Info
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useSessionStore } from '../../store/sessionStore'
import { supabase } from '../../lib/supabase'
import { anonymiseResume, scoreResume } from '../../lib/api'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { useToast } from '../../components/ui/Toast'

// Fetch the session's job description fresh each time — avoids race condition
async function fetchJobDescription(sessionId) {
  const { data } = await supabase
    .from('sessions')
    .select('job_description, job_title')
    .eq('id', sessionId)
    .single()
  return data?.job_description || ''
}

const STATUS_LABEL = {
  queued: 'Queued',
  uploading: 'Uploading',
  processing: 'Processing',
  done: 'Done ✓',
  error: 'Error',
}
const STATUS_BADGE = {
  queued: 'badge-gray',
  uploading: 'badge-amber',
  processing: 'badge-indigo',
  done: 'badge-green',
  error: 'badge-red',
}

// All accepted file types — PDF, DOCX, DOC, TXT
const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'text/plain': ['.txt'],
  // Some browsers/OS send octet-stream for .doc files
  'application/octet-stream': ['.doc', '.docx'],
}

function FileItem({ file, onRemove }) {
  const ext = file.name.split('.').pop().toLowerCase()
  const extColor = ext === 'pdf' ? 'bg-red-100 text-red-500' :
    ext === 'docx' || ext === 'doc' ? 'bg-blue-100 text-blue-500' : 'bg-gray-100 text-gray-500'

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50 group">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${extColor}`}>
        <FileText className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <span className={STATUS_BADGE[file.status]}>{STATUS_LABEL[file.status]}</span>
            {file.status === 'queued' && (
              <button
                onClick={() => onRemove(file.id)}
                className="text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <ProgressBar
          value={file.progress}
          status={file.status}
          label={`${(file.size / 1024).toFixed(0)} KB · ${ext.toUpperCase()}`}
        />
        {file.error && (
          <p className="text-xs text-red-500 mt-1 flex items-start gap-1">
            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            {file.error}
          </p>
        )}
      </div>
    </div>
  )
}

export default function Upload() {
  const { id: sessionId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { fetchSession, currentSession } = useSessionStore()
  const toast = useToast()
  const [files, setFiles] = useState([])
  const [processing, setProcessing] = useState(false)
  const [allDone, setAllDone] = useState(false)
  const currentSessionRef = useRef(currentSession)

  useEffect(() => { currentSessionRef.current = currentSession }, [currentSession])
  useEffect(() => { fetchSession(sessionId) }, [sessionId])

  const onDrop = useCallback((accepted, rejected) => {
    const newFiles = accepted.map((f) => ({
      id: Math.random().toString(36).slice(2),
      file: f, name: f.name, size: f.size,
      status: 'queued', progress: 0, error: null,
    }))

    // Handle rejected files with clear messages
    const rejectedFiles = rejected.map((r) => ({
      id: Math.random().toString(36).slice(2),
      file: r.file, name: r.file?.name || 'unknown', size: r.file?.size || 0,
      status: 'error', progress: 0,
      error: r.errors?.map((e) => {
        if (e.code === 'file-too-large') return `Too large (max 10MB)`
        if (e.code === 'file-invalid-type') return `Unsupported type — use PDF, DOCX, DOC, or TXT`
        return e.message
      }).join(', ') || 'Rejected',
    }))

    setFiles((prev) => [...prev, ...newFiles, ...rejectedFiles])
    if (rejectedFiles.length > 0) {
      toast(`${rejectedFiles.length} file(s) rejected`, 'warning')
    }
    if (newFiles.length > 0) {
      toast(`${newFiles.length} file(s) added`, 'info')
    }
  }, [toast])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: 10 * 1024 * 1024, // 10 MB
    maxFiles: 20,
    // Don't reject on MIME type mismatch for .doc — rely on extension
    validator: (file) => {
      const ext = file.name.split('.').pop().toLowerCase()
      if (!['pdf', 'docx', 'doc', 'txt'].includes(ext)) {
        return { code: 'file-invalid-type', message: 'Use PDF, DOCX, DOC, or TXT' }
      }
      return null
    },
  })

  const removeFile = (id) => setFiles((prev) => prev.filter((f) => f.id !== id))
  const updateFile = (id, updates) =>
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, ...updates } : f))

  const processFile = async (fileObj) => {
    const { id, file, name } = fileObj
    try {
      // 1. Mark as uploading
      updateFile(id, { status: 'uploading', progress: 15 })

      // 2. Try to upload to Supabase Storage (non-fatal if bucket doesn't exist)
      try {
        const path = `${sessionId}/${id}-${name}`
        await supabase.storage.from('resumes').upload(path, file)
      } catch {
        // Storage upload is optional — the resume is processed without it
      }

      updateFile(id, { progress: 35, status: 'processing' })

      // 3. Anonymise via backend (PII stripped BEFORE scoring)
      let anon
      try {
        anon = await anonymiseResume(file, sessionId)
      } catch (err) {
        const msg = err.message || 'Anonymisation failed'
        // Try to extract backend error detail
        let detail = msg
        try {
          const parsed = JSON.parse(msg)
          detail = parsed.detail || msg
        } catch {}
        throw new Error(detail)
      }
      updateFile(id, { progress: 65 })

      // 4. Score the ANONYMISED text against the job description
      // CRITICAL: fetch JD fresh from DB — don't rely on session ref (race condition)
      const jd = await fetchJobDescription(sessionId)
      if (!jd) {
        console.warn('Job description is empty — scores will be 0. Ensure a JD was set for this session.')
      }
      const scoreData = await scoreResume({
        session_id: sessionId,
        resume_id: id,
        anonymised_text: anon.anonymised_text,
        job_description: jd,
      })
      updateFile(id, { progress: 85 })

      // 5. Persist result in database — original_file_name kept for identity reveal only
      const { error: dbError } = await supabase.from('resumes').insert({
        id,
        session_id: sessionId,
        uploaded_by: user.id,
        original_file_name: name,
        file_type: name.toLowerCase().endsWith('.pdf') ? 'pdf' :
          name.toLowerCase().endsWith('.docx') ? 'docx' :
          name.toLowerCase().endsWith('.doc') ? 'doc' : 'txt',
        file_size: file.size,
        uploaded_at: new Date().toISOString(),
        processing_status: 'done',
        anonymised_content: anon.anonymised_text,
        score_breakdown: scoreData.score_breakdown,
        overall_score: scoreData.overall_score,
        is_shortlisted: false,
        manually_adjusted: false,
        identity_revealed: false,
      })

      if (dbError) {
        console.error('DB insert error:', dbError)
        throw new Error(`Database error: ${dbError.message}`)
      }

      // 6. Log PII stripping events
      if (anon.pii_found?.length) {
        const logs = anon.pii_found.map((p) => ({
          resume_id: id,
          session_id: sessionId,
          field_stripped: p.field,
          stripped_at: new Date().toISOString(),
          stripped_by: 'system',
        }))
        await supabase.from('pii_audit_log').insert(logs)
      }

      updateFile(id, { progress: 100, status: 'done' })
    } catch (err) {
      const msg = err.message || 'Processing failed'
      updateFile(id, { status: 'error', error: msg })

      // Also try to log the failed attempt in DB
      try {
        await supabase.from('resumes').upsert({
          id,
          session_id: sessionId,
          uploaded_by: user.id,
          original_file_name: fileObj.name,
          processing_status: 'error',
          overall_score: 0,
          identity_revealed: false,
        })
      } catch {}
    }
  }

  const startScreening = async () => {
    const queued = files.filter((f) => f.status === 'queued')
    if (queued.length === 0) return
    setProcessing(true)
    toast('Processing started — PII will be stripped before scoring', 'info')

    // Process all queued files concurrently
    await Promise.all(queued.map(processFile))

    // Auto-shortlist top 5 by score
    try {
      const { data: allResumes } = await supabase
        .from('resumes')
        .select('id, overall_score')
        .eq('session_id', sessionId)
        .order('overall_score', { ascending: false })

      if (allResumes && allResumes.length > 0) {
        const top5 = allResumes.slice(0, 5).map((r) => r.id)
        await Promise.all(
          top5.map((rid) =>
            supabase.from('resumes').update({ is_shortlisted: true }).eq('id', rid)
          )
        )
        // Update session counts
        await supabase
          .from('sessions')
          .update({
            resume_count: allResumes.length,
            shortlisted_count: Math.min(5, allResumes.length),
          })
          .eq('id', sessionId)
      }
    } catch (err) {
      console.error('Post-processing error:', err)
    }

    setProcessing(false)
    setAllDone(true)

    const done = files.filter((f) => f.status !== 'error').length
    const errs = files.filter((f) => f.status === 'error').length
    if (errs > 0 && done > 0) {
      toast(`${done} processed ✓ · ${errs} failed`, 'warning')
    } else if (errs > 0 && done === 0) {
      toast(`All ${errs} file(s) failed to process. Check file formats.`, 'error')
    } else {
      toast(`All ${done} resume(s) anonymised and scored ✓`, 'success')
    }
  }

  const validFiles = files.filter((f) => f.status !== 'error')
  const doneCount = files.filter((f) => f.status === 'done').length
  const errorCount = files.filter((f) => f.status === 'error').length
  const queuedCount = files.filter((f) => f.status === 'queued').length
  const allProcessed = validFiles.length > 0 && validFiles.every((f) => f.status === 'done')

  return (
    <div className="max-w-2xl animate-slide-up space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Resumes</h1>
        {currentSession && (
          <p className="text-gray-500 text-sm mt-1">
            Pipeline: <span className="font-semibold text-gray-800">{currentSession.job_title}</span>
          </p>
        )}
      </div>

      {/* Anonymity notice */}
      <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-3.5">
        <ShieldCheck className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-indigo-800">PII Anonymisation Active</p>
          <p className="text-xs text-indigo-600 mt-0.5">
            Names, emails, phone numbers, university names, addresses, and nationality are
            stripped before any scoring. Recruiters never see raw PII.
          </p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
          isDragActive
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <UploadIcon className={`w-10 h-10 mx-auto mb-3 ${isDragActive ? 'text-indigo-500' : 'text-gray-300'}`} />
        <p className="font-semibold text-gray-700">
          {isDragActive ? 'Drop resumes here…' : 'Drag & drop up to 20 resumes'}
        </p>
        <p className="text-sm text-gray-400 mt-1">PDF, DOCX, DOC, TXT · Max 10 MB per file</p>
        <button type="button" className="btn-secondary mx-auto mt-4">
          <File className="w-4 h-4" /> Browse files
        </button>
      </div>

      {/* Info */}
      <div className="flex items-center gap-2 text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-amber-500 flex-shrink-0" />
        All PII is stripped before scoring. Original file names are stored encrypted and only revealed
        after explicit recruiter action with full audit logging.
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 text-sm">
              {files.length} file{files.length > 1 ? 's' : ''} selected
            </h3>
            <div className="flex gap-3 text-xs">
              {queuedCount > 0 && <span className="text-gray-500">{queuedCount} queued</span>}
              {doneCount > 0 && <span className="text-emerald-600 font-medium">{doneCount} processed ✓</span>}
              {errorCount > 0 && <span className="text-red-500 font-medium">{errorCount} failed</span>}
            </div>
          </div>
          <div className="space-y-2">
            {files.map((f) => <FileItem key={f.id} file={f} onRemove={removeFile} />)}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        {!allDone && (
          <button
            onClick={startScreening}
            disabled={processing || queuedCount < 1}
            className="btn-primary"
          >
            {processing ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Anonymising & scoring…
              </>
            ) : (
              <><Play className="w-4 h-4" /> Start Screening ({queuedCount} resume{queuedCount !== 1 ? 's' : ''})</>
            )}
          </button>
        )}
        {(allDone || allProcessed) && doneCount > 0 && (
          <button
            onClick={() => navigate(`/session/${sessionId}/results`)}
            className="btn-primary"
          >
            <CheckCircle className="w-4 h-4" />
            View Rankings ({doneCount} candidate{doneCount !== 1 ? 's' : ''})
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
        {files.length > 0 && !processing && (
          <button
            onClick={() => setFiles([])}
            className="btn-secondary text-red-500 hover:bg-red-50"
          >
            <X className="w-4 h-4" /> Clear all
          </button>
        )}
      </div>
    </div>
  )
}
