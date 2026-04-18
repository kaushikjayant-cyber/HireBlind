import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import AppRouter from './router'

export default function App() {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [])

  return <AppRouter />
}
