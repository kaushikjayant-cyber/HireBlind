import { useAuthStore } from '../store/authStore'
import StudentDashboard from './StudentDashboard'
import CompanyDashboard from './CompanyDashboard'
import AdminDashboard from './AdminDashboard'

export default function Dashboard() {
  const { role } = useAuthStore()

  if (role === 'student') return <StudentDashboard />
  if (role === 'admin') return <AdminDashboard />
  return <CompanyDashboard />
}
