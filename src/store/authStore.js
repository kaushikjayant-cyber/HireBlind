import { create } from 'zustand'
import { supabase } from '../lib/supabase'

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
      const rawRole = profile?.role || session?.user?.user_metadata?.role || 'recruiter'
      const normalizedRole = rawRole === 'company' ? 'recruiter' : rawRole
      set({
        user: session.user,
        session,
        role: normalizedRole,
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
        const normalizedRole = rawRole === 'company' ? 'recruiter' : rawRole
        set({
          user: session.user,
          session,
          role: normalizedRole,
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

  register: async (email, password, role) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role } }
    })
    if (error) throw error
    if (data.user) {
      await supabase.from('users').insert({
        id: data.user.id,
        email,
        role,
        created_at: new Date().toISOString(),
      })
    }
    return data
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, role: null })
  },

  isAdmin: () => get().role === 'admin',
}))
