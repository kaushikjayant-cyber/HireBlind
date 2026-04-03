import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Settings, ChevronLeft, ChevronRight, Eye, LogOut,
  Briefcase, GraduationCap, ShieldCheck, Plus, UploadCloud, BarChart3, Users
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

// Role-specific navigation configurations
const adminNav = [
  { to: '/dashboard', icon: ShieldCheck, label: 'System Panel' },
  { to: '/admin/settings', icon: Settings, label: 'Platform Settings' },
]

const recruiterNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Hiring Dashboard' },
  { to: '/session/new', icon: Plus, label: 'New Job Description' },
]

const studentNav = [
  { to: '/dashboard', icon: GraduationCap, label: 'Resume Analyzer' },
]

const roleLabels = {
  admin: { label: 'Admin', color: 'bg-indigo-100 text-indigo-700', badgeColor: 'indigo' },
  recruiter: { label: 'Recruiter', color: 'bg-blue-100 text-blue-700', badgeColor: 'blue' },
  company: { label: 'Recruiter', color: 'bg-blue-100 text-blue-700', badgeColor: 'blue' },
  student: { label: 'Student', color: 'bg-violet-100 text-violet-700', badgeColor: 'violet' },
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, role, logout } = useAuthStore()
  const navigate = useNavigate()

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'HB'
  const roleInfo = roleLabels[role] || { label: role, color: 'bg-gray-100 text-gray-600' }

  const navItems =
    role === 'admin' ? adminNav :
    role === 'student' ? studentNav :
    recruiterNav // recruiter / company

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside
      className={`flex flex-col h-full bg-white border-r border-gray-100 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-gray-100 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Eye className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-none">HireBlind</h1>
            <p className="text-xs text-gray-400 mt-0.5">Hire for skills.</p>
          </div>
        )}
      </div>

      {/* Role Badge */}
      {!collapsed && (
        <div className={`mx-3 mt-3 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${roleInfo.color}`}>
          {role === 'admin' && <ShieldCheck className="w-3.5 h-3.5" />}
          {(role === 'recruiter' || role === 'company') && <Briefcase className="w-3.5 h-3.5" />}
          {role === 'student' && <GraduationCap className="w-3.5 h-3.5" />}
          {roleInfo.label} Portal
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto mt-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? 'sidebar-link-active' : 'sidebar-link'
            }
            title={collapsed ? item.label : undefined}
            end={item.to === '/dashboard'}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}

        {/* Recruiter-specific quick actions */}
        {(role === 'recruiter' || role === 'company') && !collapsed && (
          <div className="pt-3 mt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 font-medium px-3 mb-2 uppercase tracking-wider">Quick Actions</p>
            <NavLink
              to="/session/new"
              className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}
            >
              <UploadCloud className="w-4 h-4 flex-shrink-0" />
              <span>Upload Resumes</span>
            </NavLink>
          </div>
        )}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-gray-100 space-y-1">
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gray-50">
            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-indigo-700">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">{user?.email}</p>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium mt-0.5 ${roleInfo.color}`}>
                {roleInfo.label}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="sidebar-link w-full text-red-500 hover:bg-red-50 hover:text-red-600"
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="sidebar-link w-full"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  )
}
