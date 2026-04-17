import React, { useState, useEffect } from 'react'
import { api } from '../api'
import { Building2, Star, TrendingUp, AlertTriangle, ArrowRight, Clock, Activity } from 'lucide-react'

function StatCard({ label, value, sub, icon: Icon, color = 'text-white' }) {
  return (
    <div className="bg-cw-card border border-cw-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
        {Icon && <Icon className={`w-4 h-4 ${color}`} />}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}

function StatusBadge({ status }) {
  const colors = {
    sourced: 'bg-gray-600',
    under_review: 'bg-blue-600',
    modeled: 'bg-purple-600',
    shortlisted: 'bg-cw-yellow text-black',
    under_contract: 'bg-cw-orange',
    closed: 'bg-cw-green',
    killed: 'bg-cw-red',
    dead: 'bg-cw-red',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-gray-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export default function Dashboard({ onNavigateToDeal, onNavigate }) {
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState([])
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getStats(),
      api.getActivity({ limit: 10 }),
      api.getDeals({ sort: 'created_at', dir: 'desc' }),
    ]).then(([s, a, d]) => {
      setStats(s)
      setActivity(a.activity || [])
      setDeals(d.deals || [])
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    )
  }

  const starredDeals = deals.filter(d => d.starred)
  const recentDeals = deals.slice(0, 5)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pipeline Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">CW Properties — Development & Acquisitions</p>
        </div>
        <button
          onClick={() => onNavigate('new-deal')}
          className="px-4 py-2 bg-cw-accent text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          + New Deal
        </button>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Deals" value={stats.total} icon={Building2} color="text-cw-accent" />
          <StatCard label="Active Deals" value={stats.active_deals} icon={TrendingUp} color="text-cw-green" />
          <StatCard label="Starred" value={stats.starred} icon={Star} color="text-cw-yellow" />
          <StatCard
            label="Avg Cap Rate"
            value={stats.avg_cap_rate ? `${(stats.avg_cap_rate * 100).toFixed(1)}%` : '—'}
            sub={stats.avg_dscr ? `${stats.avg_dscr.toFixed(2)}x DSCR` : ''}
            icon={TrendingUp}
            color="text-cw-green"
          />
        </div>
      )}

      {/* Status breakdown */}
      {stats && stats.by_status.length > 0 && (
        <div className="bg-cw-card border border-cw-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">Pipeline Breakdown</h2>
          <div className="flex gap-2 flex-wrap">
            {stats.by_status.map(({ status, count }) => (
              <div key={status} className="flex items-center gap-2 bg-cw-dark rounded-lg px-3 py-2">
                <StatusBadge status={status} />
                <span className="text-sm font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Deals */}
        <div className="bg-cw-card border border-cw-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400">Recent Deals</h2>
            <button onClick={() => onNavigate('pipeline')} className="text-xs text-cw-accent hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {recentDeals.length === 0 ? (
            <div className="text-sm text-gray-500 py-8 text-center">
              No deals yet. <button onClick={() => onNavigate('new-deal')} className="text-cw-accent hover:underline">Add your first deal</button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentDeals.map(deal => (
                <button
                  key={deal.id}
                  onClick={() => onNavigateToDeal(deal.id)}
                  className="w-full text-left flex items-center justify-between p-2 rounded-lg hover:bg-cw-hover transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2">
                      {deal.starred ? <Star className="w-3 h-3 text-cw-yellow fill-cw-yellow" /> : null}
                      {deal.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {[deal.city, deal.state].filter(Boolean).join(', ')}
                      {deal.units ? ` · ${deal.units} units` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={deal.status} />
                    {deal.metrics?.going_in_cap_rate ? (
                      <div className="text-xs text-gray-500 mt-1">
                        {(deal.metrics.going_in_cap_rate * 100).toFixed(1)}% cap
                      </div>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="bg-cw-card border border-cw-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-400">Recent Activity</h2>
          </div>
          {activity.length === 0 ? (
            <div className="text-sm text-gray-500 py-8 text-center">No activity yet</div>
          ) : (
            <div className="space-y-2">
              {activity.map(a => (
                <div key={a.id} className="flex items-start gap-2 text-xs py-1">
                  <Clock className="w-3 h-3 text-gray-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-gray-300">
                      {a.action.replace(/_/g, ' ')}
                    </span>
                    {a.deal_name && (
                      <span className="text-cw-accent ml-1">{a.deal_name}</span>
                    )}
                    <div className="text-gray-600">
                      {a.user_email} · {new Date(a.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
