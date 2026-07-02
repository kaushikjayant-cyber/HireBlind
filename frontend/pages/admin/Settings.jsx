import { useState, useEffect } from 'react'
import { Users, Settings, Mail, Shield, Trash2, AlertCircle, Key, Copy, Check, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

export default function AdminSettings() {
  const { user, adminKey, rotateAdminKey } = useAuthStore()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [rotating, setRotating] = useState(false)

  const handleCopyKey = () => {
    if (!adminKey) return
    navigator.clipboard.writeText(adminKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRotateKey = async () => {
    if (!window.confirm('Are you sure you want to rotate your admin key? Any recruiters currently trying to register with the old key will need the new one.')) {
      return
    }
    setRotating(true)
    try {
      await rotateAdminKey()
      setMessage('Admin key regenerated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      console.error(err)
      alert('Failed to rotate admin key')
    } finally {
      setRotating(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    setLoading(true)
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  const toggleRole = async (uid, currentRole) => {
    const newRole = currentRole === 'admin' ? 'recruiter' : 'admin'
    await supabase.from('users').update({ role: newRole }).eq('id', uid)
    setUsers((prev) => prev.map((u) => u.id === uid ? { ...u, role: newRole } : u))
    setMessage(`Role updated to ${newRole}`)
    setTimeout(() => setMessage(''), 3000)
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage users and organisation settings</p>
      </div>

      {message && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-sm text-emerald-700">
          <Shield className="w-4 h-4" />
          {message}
        </div>
      )}

      {/* Org settings */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-400" />
          Organisation Settings
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Organisation Name</label>
            <input className="input-field" defaultValue="My Company BV" />
          </div>
          <div>
            <label className="label">Contact Email</label>
            <input type="email" className="input-field" defaultValue={user?.email} />
          </div>
        </div>
        <div className="mt-4 p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-xs text-indigo-700">
          <strong>EU AI Act Disclosure:</strong> This system is classified as a High-Risk AI system under EU AI Act Annex III (Employment & Workers Management). It is operated under human oversight per Article 14.
        </div>
        <div className="mt-4">
          <button className="btn-primary">Save Settings</button>
        </div>
      </div>

      {/* Recruiter Registration Key */}
      <div className="card bg-gradient-to-br from-indigo-50/40 via-white to-indigo-50/20 border-indigo-100 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Key className="w-5 h-5 text-indigo-500" />
          Recruiter Invite Key
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Provide this key to recruiters in your organization. They must enter it during registration to link their account to your tenant.
        </p>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              readOnly
              value={adminKey || 'NO KEY GENERATED'}
              className="input-field font-mono uppercase tracking-widest text-center text-lg font-bold bg-gray-50 border-gray-200 select-all pr-10"
            />
            <button
              onClick={handleCopyKey}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-gray-100 transition-colors"
              title="Copy Key"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <button
            onClick={handleRotateKey}
            disabled={rotating}
            className="btn-secondary flex items-center gap-2 py-2.5"
            title="Generate new key"
          >
            <RefreshCw className={`w-4 h-4 ${rotating ? 'animate-spin' : ''}`} />
            {rotating ? 'Generating...' : 'Rotate Key'}
          </button>
        </div>
      </div>

      {/* User management */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-400" />
          User Management
          <span className="badge-gray ml-auto">{users.length} users</span>
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mr-2" />
            Loading...
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-4 text-xs font-medium text-gray-400 uppercase tracking-wide">User</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-gray-400 uppercase tracking-wide">Role</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-gray-400 uppercase tracking-wide">Joined</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span className="text-xs font-bold text-indigo-700">{u.email?.slice(0, 2).toUpperCase()}</span>
                        </div>
                        <span className="text-gray-800 font-medium">{u.email}</span>
                        {u.id === user?.id && <span className="badge-indigo text-xs">You</span>}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={u.role === 'admin' ? 'badge-indigo' : 'badge-gray'}>{u.role}</span>
                    </td>
                    <td className="py-3 pr-4 text-gray-400 text-xs">
                      {new Date(u.created_at).toLocaleDateString('nl-NL')}
                    </td>
                    <td className="py-3">
                      {u.id !== user?.id && (
                        <button
                          onClick={() => toggleRole(u.id, u.role)}
                          className="btn-secondary text-xs py-1.5"
                        >
                          Make {u.role === 'admin' ? 'Recruiter' : 'Admin'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
