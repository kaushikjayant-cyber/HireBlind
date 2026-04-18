import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, Mail, Lock, Briefcase, ShieldCheck, AlertCircle, CheckCircle, Key } from 'lucide-react'
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
  const [adminKey, setAdminKey] = useState('')
  const [keyStatus, setKeyStatus] = useState(null) // null | 'checking' | 'valid' | 'invalid'
  const [keyAdminEmail, setKeyAdminEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { register } = useAuthStore()
  const navigate = useNavigate()

  // Live admin key validation as user types
  const handleKeyChange = async (val) => {
    setAdminKey(val)
    setKeyStatus(null)
    setKeyAdminEmail('')
    if (val.trim().length < 6) return
    setKeyStatus('checking')
    try {
      const res = await fetch('/api/admin-key/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_key: val.trim().toUpperCase() }),
      })
      const data = await res.json()
      if (data.valid) {
        setKeyStatus('valid')
        setKeyAdminEmail(data.admin_email)
      } else {
        setKeyStatus('invalid')
      }
    } catch {
      setKeyStatus(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (role === 'recruiter' && !adminKey.trim()) {
      setError('Admin key is required for Recruiter accounts.')
      return
    }
    if (role === 'recruiter' && keyStatus === 'invalid') {
      setError('Invalid admin key. Please check it with your Admin.')
      return
    }
    setLoading(true)
    try {
      await register(email, password, role, adminKey)
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
                {/* Email */}
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

                {/* Password */}
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

                {/* Role selector */}
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
                          onClick={() => { setRole(r.id); setAdminKey(''); setKeyStatus(null) }}
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

                {/* Admin Key — only shown for recruiter role */}
                {role === 'recruiter' && (
                  <div>
                    <label className="label flex items-center gap-1">
                      <Key className="w-3.5 h-3.5" /> Admin Key <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={adminKey}
                        onChange={(e) => handleKeyChange(e.target.value)}
                        className={`input-field pl-10 uppercase tracking-widest font-mono ${
                          keyStatus === 'valid' ? 'border-emerald-400 bg-emerald-50' :
                          keyStatus === 'invalid' ? 'border-red-400 bg-red-50' : ''
                        }`}
                        placeholder="Ask your Admin for this key"
                        maxLength={8}
                        required
                      />
                    </div>

                    {/* Live feedback */}
                    {keyStatus === 'checking' && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <span className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                        Checking key…
                      </p>
                    )}
                    {keyStatus === 'valid' && (
                      <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        ✓ Valid key — linked to <strong className="ml-1">{keyAdminEmail}</strong>
                      </p>
                    )}
                    {keyStatus === 'invalid' && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Invalid key — check with your Admin
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">
                      Your account will be linked to the Admin who owns this key.
                    </p>
                  </div>
                )}

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
