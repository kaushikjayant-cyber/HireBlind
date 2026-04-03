import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, Mail, Lock, Briefcase, ShieldCheck, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

const ROLES = [
  {
    id: 'recruiter',
    label: 'Recruiter',
    desc: 'Upload resumes & screen candidates',
    icon: Briefcase,
    color: 'blue',
  },
  {
    id: 'admin',
    label: 'Admin',
    desc: 'Manage system & audit logs',
    icon: ShieldCheck,
    color: 'indigo',
  },
]

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('recruiter')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { register } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    try {
      await register(email, password, role)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(err.message || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4 shadow-lg">
            <Eye className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">HireBlind Pro</h1>
          <p className="text-gray-500 mt-1 text-sm">Bias-free hiring. Skill-first screening.</p>
        </div>

        <div className="card shadow-md">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Create your account</h2>

          {success ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500" />
              <p className="font-medium text-gray-800">Account created!</p>
              <p className="text-sm text-gray-500">Check your email to verify your account. Redirecting to login…</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email" value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-field pl-10"
                      placeholder="you@company.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password" value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-field pl-10"
                      placeholder="Min. 6 characters"
                      required
                    />
                  </div>
                </div>

                {/* Role selector — Admin and Recruiter only */}
                <div>
                  <label className="label">Select your role</label>
                  <div className="grid grid-cols-2 gap-3">
                    {ROLES.map((r) => {
                      const Icon = r.icon
                      const active = role === r.id
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setRole(r.id)}
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 text-center ${
                            active
                              ? r.color === 'blue'
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-sm font-semibold">{r.label}</span>
                          <span className="text-[10px] leading-tight text-gray-400">{r.desc}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 mt-2">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating account…
                    </span>
                  ) : 'Create account'}
                </button>
              </form>
            </>
          )}

          <p className="text-center text-sm text-gray-500 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
