import React from 'react'
import { Building2, LayoutDashboard, Kanban, Plus, User, BookOpen, ClipboardList } from 'lucide-react'

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'pipeline', label: 'Pipeline', icon: Kanban },
  { key: 'new-deal', label: 'New Deal', icon: Plus },
  { key: 'strategies', label: 'Strategies', icon: BookOpen },
  { key: 'underwriting', label: 'Underwriting', icon: ClipboardList },
]

export default function Layout({ currentPage, onNavigate, user, children }) {
  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-56 bg-cw-card border-r border-cw-border flex flex-col shrink-0">
        {/* Logo */}
        <div className="p-4 border-b border-cw-border">
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-cw-accent" />
            <div>
              <div className="font-semibold text-sm">CW Properties</div>
              <div className="text-xs text-gray-500">Deal Pipeline</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                currentPage === key
                  ? 'bg-cw-accent/10 text-cw-accent'
                  : 'text-gray-400 hover:text-white hover:bg-cw-hover'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        {/* User */}
        {user && (
          <div className="p-3 border-t border-cw-border">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <User className="w-3 h-3" />
              <span className="truncate">{user.email}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}
