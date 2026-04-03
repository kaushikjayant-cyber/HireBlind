import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FolderOpen, Shield, Settings,
  ChevronLeft, ChevronRight, Eye, LogOut
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/session/new', icon: FolderOpen, label: 'New Session', requireStaff: true },
  { to: '/admin/settings', icon: Settings, label: 'Settings', adminOnly: true },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, role, logout } = useAuthStore()
  const navigate = useNavigate()

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'HB'

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

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          if (item.adminOnly && role !== 'admin') return null
          if (item.requireStaff && role === 'student') return null
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'sidebar-link-active' : 'sidebar-link'
              }
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          )
        })}
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
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium mt-0.5 ${
                role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {role}
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
