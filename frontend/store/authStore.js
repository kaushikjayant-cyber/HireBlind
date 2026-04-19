import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const BASE = import.meta.env.VITE_API_URL || ''

export const useAuthStore = create((set, get) => ({
  user: null,
  role: null,
  loading: true,
  session: null,

  initialize: async () => {
    set({ loading: true })
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single()
      // Only admin and recruiter are valid roles
      const rawRole = profile?.role || session?.user?.user_metadata?.role || 'recruiter'
      const validRole = ['admin', 'recruiter'].includes(rawRole) ? rawRole : 'recruiter'
      set({
        user: session.user,
        session,
        role: validRole,
        loading: false,
      })
    } else {
      set({ user: null, session: null, role: null, loading: false })
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single()
        const rawRole = profile?.role || session.user.user_metadata?.role || 'recruiter'
        const validRole = ['admin', 'recruiter'].includes(rawRole) ? rawRole : 'recruiter'
        set({
          user: session.user,
          session,
          role: validRole,
          loading: false,
        })
      } else {
        set({ user: null, session: null, role: null, loading: false })
      }
    })
  },

  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },

  loginWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) throw error
  },

  register: async (email, password, role, adminKey = '') => {
    const safeRole = ['admin', 'recruiter'].includes(role) ? role : 'recruiter'

    // Recruiters must provide an admin key
    if (safeRole === 'recruiter' && !adminKey.trim()) {
      throw new Error('Admin key is required for Recruiter accounts. Ask your Admin for the key.')
    }

    // If recruiter — validate key exists before creating account
    if (safeRole === 'recruiter') {
      const check = await fetch(`${BASE}/api/admin-key/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_key: adminKey.trim().toUpperCase() }),
      })
      const validation = await check.json()
      if (!validation.valid) {
        throw new Error('Invalid admin key. Ask your Admin for the correct 8-character key.')
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: safeRole } }
    })
    if (error) throw error

    if (data.user) {
      // Insert base users row
      await supabase.from('users').insert({
        id: data.user.id,
        email,
        role: safeRole,
        created_at: new Date().toISOString(),
      })

      if (safeRole === 'admin') {
        // Generate an admin_key for new admins via backend
        await fetch(`${BASE}/api/admin-key/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_id: data.user.id }),
        })
      } else if (safeRole === 'recruiter') {
        // Assign admin_id using the validated key
        await fetch(`${BASE}/api/admin-key/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: data.user.id, admin_key: adminKey.trim().toUpperCase() }),
        })
      }
    }
    return data
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, role: null })
  },

  isAdmin: () => get().role === 'admin',
  isRecruiter: () => get().role === 'recruiter',
}))
