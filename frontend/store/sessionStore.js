import { create } from 'zustand'
import {
  fetchSessionsAPI,
  fetchSessionAPI,
  createSessionAPI,
  updateSessionAPI
} from '../lib/api'

export const useSessionStore = create((set, get) => ({
  sessions: [],
  currentSession: null,
  loading: false,

  fetchSessions: async () => {
    set({ loading: true })
    try {
      const data = await fetchSessionsAPI()
      set({ sessions: data || [] })
    } catch (err) {
      console.error('[sessionStore] fetchSessions failed:', err)
    } finally {
      set({ loading: false })
    }
  },

  fetchSession: async (id) => {
    try {
      const data = await fetchSessionAPI(id)
      set({ currentSession: data })
      return data
    } catch (err) {
      console.error('[sessionStore] fetchSession failed:', err)
      throw err
    }
  },

  createSession: async (sessionData) => {
    const payload = {
      job_title: sessionData.job_title,
      job_description: sessionData.job_description,
      status: sessionData.status || 'active',
    }
    const data = await createSessionAPI(payload)
    set((state) => ({ sessions: [data, ...state.sessions] }))
    return data
  },

  updateSession: async (id, updates) => {
    const data = await updateSessionAPI(id, updates)
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? data : s)),
      currentSession: state.currentSession?.id === id ? data : state.currentSession,
    }))
    return data
  },
}))
