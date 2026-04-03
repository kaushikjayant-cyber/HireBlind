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

function ProtectedRoute({ children, adminOnly = false, requireStaff = false }) {
  const { user, loading, role } = useAuthStore()
  if (loading) return <LoadingSpinner fullScreen />
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && role !== 'admin') return <Navigate to="/dashboard" replace />
  if (requireStaff && role === 'student') return <Navigate to="/dashboard" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return <LoadingSpinner fullScreen />
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="session/new" element={<ProtectedRoute requireStaff><NewSession /></ProtectedRoute>} />
        <Route path="session/:id/upload" element={<ProtectedRoute requireStaff><Upload /></ProtectedRoute>} />
        <Route path="session/:id/results" element={<ProtectedRoute requireStaff><Results /></ProtectedRoute>} />
        <Route path="session/:id/compliance" element={<ProtectedRoute requireStaff><Compliance /></ProtectedRoute>} />
        <Route path="session/:id/interviews" element={<ProtectedRoute requireStaff><Interviews /></ProtectedRoute>} />
        <Route path="admin/settings" element={<ProtectedRoute adminOnly><AdminSettings /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
