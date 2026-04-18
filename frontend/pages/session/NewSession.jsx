import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Briefcase, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useSessionStore } from '../../store/sessionStore'

export default function NewSession() {
  const [jobTitle, setJobTitle] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { user } = useAuthStore()
  const { createSession } = useSessionStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!jobTitle.trim() || !jobDescription.trim()) {
      setError('Please fill in both fields.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const session = await createSession({
        job_title: jobTitle,
        job_description: jobDescription,
        created_by: user.id,
        status: 'active',
        created_at: new Date().toISOString(),
        resume_count: 0,
        shortlisted_count: 0,
      })
      navigate(`/session/${session.id}/upload`)
    } catch (err) {
      setError(err.message || 'Failed to create session.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl animate-slide-up space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Screening Session</h1>
        <p className="text-gray-500 text-sm mt-1">Define the job description — candidates will be scored against it.</p>
      </div>

      <div className="card">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-5 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">
              <Briefcase className="inline w-4 h-4 mr-1.5 mb-0.5 text-gray-400" />
              Job Title
            </label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="input-field"
              placeholder="e.g. Senior Python Developer"
              required
            />
          </div>

          <div>
            <label className="label">
              <FileText className="inline w-4 h-4 mr-1.5 mb-0.5 text-gray-400" />
              Job Description
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Include required skills, years of experience, responsibilities, and any key competencies. The AI uses this to score each resume.
            </p>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className="input-field resize-none"
              rows={10}
              placeholder={`Example:\n\nWe are looking for a Senior Python Developer with 5+ years of experience...\n\nRequired Skills:\n- Python, FastAPI, PostgreSQL\n- Docker, CI/CD\n- Team leadership\n\nNice to have:\n- React, TypeScript\n- Machine learning experience`}
              required
            />
            <p className="text-xs text-gray-400 mt-1.5">{jobDescription.length} characters — more detail = better scoring accuracy</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => navigate('/dashboard')} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </span>
              ) : 'Create Session & Upload Resumes →'}
            </button>
          </div>
        </form>
      </div>

      {/* Tips */}
      <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100">
        <h3 className="text-sm font-semibold text-indigo-800 mb-2">💡 Tips for better results</h3>
        <ul className="space-y-1 text-xs text-indigo-700">
          <li>• List concrete required skills (e.g. "Python 3.10", "REST APIs")</li>
          <li>• Specify exact years of experience required</li>
          <li>• Mention soft skills and team context</li>
          <li>• Dutch + English JDs both supported</li>
        </ul>
      </div>
    </div>
  )
}
