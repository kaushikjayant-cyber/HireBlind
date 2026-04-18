import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import AppShell from '../components/layout/AppShell'
import Login from '../pages/auth/Login'
import Register from '../pages/auth/Register'
import Dashboard from '../pages/Dashboard'
import NewSession from '../pages/session/NewSession'
import Upload from '../pages/session/Upload'
import Results from '../pages/session/Results'
import Compliance from '../pages/session/Compliance'
import Interviews from '../pages/session/Interviews'
import AdminSettings from '../pages/admin/Settings'
import LoadingSpinner from '../components/ui/LoadingSpinner'

// Recruiter-only routes
function RecruiterRoute({ children }) {
  const { user, loading, role } = useAuthStore()
  if (loading) return <LoadingSpinner fullScreen />
  if (!user) return <Navigate to="/login" replace />
  if (role !== 'recruiter') return <Navigate to="/dashboard" replace />
  return children
}

// Admin-only routes
function AdminRoute({ children }) {
  const { user, loading, role } = useAuthStore()
  if (loading) return <LoadingSpinner fullScreen />
  if (!user) return <Navigate to="/login" replace />
  if (role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

// Any authenticated user (admin or recruiter)
function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return <LoadingSpinner fullScreen />
  if (!user) return <Navigate to="/login" replace />
  return children
}

// Redirect if already logged in
function PublicRoute({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return <LoadingSpinner fullScreen />
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

export default function AppRouter() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

      {/* Protected shell */}
      <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* Role-dependent dashboard */}
        <Route path="dashboard" element={<Dashboard />} />

        {/* Recruiter-only routes */}
        <Route path="session/new" element={<RecruiterRoute><NewSession /></RecruiterRoute>} />
        <Route path="session/:id/upload" element={<RecruiterRoute><Upload /></RecruiterRoute>} />
        <Route path="session/:id/results" element={<RecruiterRoute><Results /></RecruiterRoute>} />
        <Route path="session/:id/compliance" element={<RecruiterRoute><Compliance /></RecruiterRoute>} />
        <Route path="session/:id/interviews" element={<RecruiterRoute><Interviews /></RecruiterRoute>} />

        {/* Admin-only routes */}
        <Route path="admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
