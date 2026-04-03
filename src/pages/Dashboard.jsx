import { useAuthStore } from '../store/authStore'
import RecruiterDashboard from './RecruiterDashboard'
import AdminDashboard from './AdminDashboard'

export default function Dashboard() {
  const { role } = useAuthStore()

  if (role === 'admin') return <AdminDashboard />
  return <RecruiterDashboard />
}
