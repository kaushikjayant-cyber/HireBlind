import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useSessionStore = create((set, get) => ({
  sessions: [],
  currentSession: null,
  loading: false,

  fetchSessions: async (userId) => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) set({ sessions: data || [] })
    set({ loading: false })
  },

  fetchSession: async (id) => {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .single()
    if (!error) set({ currentSession: data })
    return data
  },

  createSession: async (sessionData) => {
    const { data, error } = await supabase
      .from('sessions')
      .insert(sessionData)
      .select()
      .single()
    if (error) throw error
    set((state) => ({ sessions: [data, ...state.sessions] }))
    return data
  },

  updateSession: async (id, updates) => {
    const { data, error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? data : s)),
      currentSession: state.currentSession?.id === id ? data : state.currentSession,
    }))
    return data
  },
}))
