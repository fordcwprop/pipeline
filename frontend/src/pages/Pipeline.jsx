import React, { useState, useEffect, useMemo } from 'react'
import { api } from '../api'
import { Star, Search, Filter, ChevronDown, ArrowUpDown } from 'lucide-react'

const STATUS_COLUMNS = [
  { key: 'sourced', label: 'Sourced', color: 'border-gray-500' },
  { key: 'under_review', label: 'Under Review', color: 'border-blue-500' },
  { key: 'modeled', label: 'Modeled', color: 'border-purple-500' },
  { key: 'shortlisted', label: 'Shortlisted', color: 'border-yellow-500' },
  { key: 'under_contract', label: 'Under Contract', color: 'border-orange-500' },
  { key: 'closed', label: 'Closed', color: 'border-green-500' },
]

function RiskIndicator({ risk }) {
  if (!risk) return null
  const colors = { low: 'bg-cw-green', medium: 'bg-cw-yellow', high: 'bg-cw-red' }
  return <div className={`w-2 h-2 rounded-full ${colors[risk.level] || 'bg-gray-500'}`} title={`Risk: ${risk.score}/10`} />
}

function DealCard({ deal, onClick }) {
  const m = deal.metrics || {}
  return (
    <button
      onClick={() => onClick(deal.id)}
      className="w-full text-left bg-cw-dark border border-cw-border rounded-lg p-3 hover:border-cw-accent/50 transition-all group"
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="text-sm font-medium text-white group-hover:text-cw-accent transition-colors truncate">
          {deal.name}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <RiskIndicator risk={deal.risk} />
          {deal.starred ? <Star className="w-3 h-3 text-cw-yellow fill-cw-yellow" /> : null}
        </div>
      </div>
      <div className="text-xs text-gray-500 mb-2">
        {[deal.city, deal.state].filter(Boolean).join(', ')}
        {deal.units ? ` · ${deal.units} units` : ''}
      </div>
      {m.going_in_cap_rate ? (
        <div className="flex gap-3 text-xs">
          <span className={m.going_in_cap_rate >= 0.055 ? 'text-cw-green' : m.going_in_cap_rate >= 0.045 ? 'text-cw-yellow' : 'text-cw-red'}>
            {(m.going_in_cap_rate * 100).toFixed(1)}% cap
          </span>
          <span className={m.dscr >= 1.25 ? 'text-cw-green' : m.dscr >= 1.15 ? 'text-cw-yellow' : 'text-cw-red'}>
            {m.dscr?.toFixed(2)}x
          </span>
          {m.price_per_unit ? (
            <span className="text-gray-400">${(m.price_per_unit / 1000).toFixed(0)}k/unit</span>
          ) : null}
        </div>
      ) : (
        <div className="text-xs text-gray-600 italic">Awaiting underwriting</div>
      )}
    </button>
  )
}

export default function Pipeline({ onNavigateToDeal }) {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showDead, setShowDead] = useState(false) // toggle covers killed + dead
  const [view, setView] = useState('board') // 'board' or 'table'
  const [stateFilter, setStateFilter] = useState('')
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    loadDeals()
  }, [])

  const loadDeals = () => {
    setLoading(true)
    api.getDeals().then(r => setDeals(r.deals || [])).catch(console.error).finally(() => setLoading(false))
  }

  const filteredDeals = useMemo(() => {
    let result = deals
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(d =>
        d.name?.toLowerCase().includes(s) ||
        d.city?.toLowerCase().includes(s) ||
        d.state?.toLowerCase().includes(s) ||
        d.submarket?.toLowerCase().includes(s)
      )
    }
    if (stateFilter) {
      result = result.filter(d => d.state === stateFilter)
    }
    return result
  }, [deals, search, stateFilter])

  const states = useMemo(() => [...new Set(deals.map(d => d.state).filter(Boolean))].sort(), [deals])

  // `killed` and `dead` are synonymous for "not pursuing" — both are hidden
  // by default. Use `killed` going forward (user preference); `dead` retained
  // for back-compat with existing deals.
  const isInactive = (d) => d.status === 'killed' || d.status === 'dead'

  // Board view - group by status
  const dealsByStatus = useMemo(() => {
    const grouped = {}
    STATUS_COLUMNS.forEach(col => grouped[col.key] = [])
    filteredDeals.forEach(d => {
      if (isInactive(d) && !showDead) return
      if (grouped[d.status]) grouped[d.status].push(d)
      else if (isInactive(d)) grouped['killed'] = [...(grouped['killed'] || []), d]
    })
    return grouped
  }, [filteredDeals, showDead])

  const deadDeals = filteredDeals.filter(isInactive)

  // Table view - sorted
  const sortedDeals = useMemo(() => {
    const result = [...filteredDeals].filter(d => showDead || !isInactive(d))
    result.sort((a, b) => {
      let aVal, bVal
      if (['going_in_cap_rate', 'dscr', 'price_per_unit', 'cash_on_cash', 'levered_irr'].includes(sortField)) {
        aVal = a.metrics?.[sortField] || 0
        bVal = b.metrics?.[sortField] || 0
      } else {
        aVal = a[sortField] || ''
        bVal = b[sortField] || ''
      }
      if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
    return result
  }, [filteredDeals, sortField, sortDir, showDead])

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  if (loading) {
    return <div className="p-8 flex items-center justify-center h-full"><div className="text-gray-500">Loading pipeline...</div></div>
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h1 className="text-xl font-bold">Pipeline</h1>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search deals..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-cw-dark border border-cw-border rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-gray-600 focus:border-cw-accent focus:outline-none w-48"
            />
          </div>
          {/* State filter */}
          {states.length > 0 && (
            <select
              value={stateFilter}
              onChange={e => setStateFilter(e.target.value)}
              className="bg-cw-dark border border-cw-border rounded-lg px-2 py-1.5 text-sm text-gray-300"
            >
              <option value="">All States</option>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {/* View toggle */}
          <div className="flex bg-cw-dark border border-cw-border rounded-lg overflow-hidden">
            <button onClick={() => setView('board')} className={`px-3 py-1.5 text-xs ${view === 'board' ? 'bg-cw-accent text-white' : 'text-gray-400'}`}>Board</button>
            <button onClick={() => setView('table')} className={`px-3 py-1.5 text-xs ${view === 'table' ? 'bg-cw-accent text-white' : 'text-gray-400'}`}>Table</button>
          </div>
        </div>
      </div>

      {view === 'board' ? (
        /* Kanban Board */
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 h-full min-w-max">
            {STATUS_COLUMNS.map(col => (
              <div key={col.key} className="w-72 flex flex-col shrink-0">
                <div className={`flex items-center gap-2 mb-3 pb-2 border-b-2 ${col.color}`}>
                  <span className="text-sm font-semibold text-gray-300">{col.label}</span>
                  <span className="text-xs bg-cw-dark px-1.5 py-0.5 rounded text-gray-500">
                    {(dealsByStatus[col.key] || []).length}
                  </span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                  {(dealsByStatus[col.key] || []).map(deal => (
                    <DealCard key={deal.id} deal={deal} onClick={onNavigateToDeal} />
                  ))}
                  {(dealsByStatus[col.key] || []).length === 0 && (
                    <div className="text-xs text-gray-600 text-center py-4">No deals</div>
                  )}
                </div>
              </div>
            ))}
            {/* Killed/Dead column - collapsible (both statuses pooled) */}
            {deadDeals.length > 0 && (
              <div className="w-72 flex flex-col shrink-0">
                <button
                  onClick={() => setShowDead(!showDead)}
                  className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-red-500 text-left"
                >
                  <span className="text-sm font-semibold text-gray-300">Killed</span>
                  <span className="text-xs bg-cw-dark px-1.5 py-0.5 rounded text-gray-500">{deadDeals.length}</span>
                  <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${showDead ? 'rotate-180' : ''}`} />
                </button>
                {showDead && (
                  <div className="flex-1 space-y-2 overflow-y-auto pr-1 opacity-60">
                    {deadDeals.map(deal => (
                      <DealCard key={deal.id} deal={deal} onClick={onNavigateToDeal} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Table View */
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-cw-dark">
              <tr className="border-b border-cw-border text-left">
                {[
                  { key: 'name', label: 'Deal' },
                  { key: 'state', label: 'State' },
                  { key: 'units', label: 'Units' },
                  { key: 'purchase_price', label: 'Price' },
                  { key: 'going_in_cap_rate', label: 'Cap Rate' },
                  { key: 'dscr', label: 'DSCR' },
                  { key: 'price_per_unit', label: '$/Unit' },
                  { key: 'cash_on_cash', label: 'CoC' },
                  { key: 'levered_irr', label: 'IRR' },
                  { key: 'status', label: 'Status' },
                ].map(col => (
                  <th key={col.key} className="px-3 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-300" onClick={() => toggleSort(col.key)}>
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sortField === col.key && <ArrowUpDown className="w-3 h-3" />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedDeals.map(deal => {
                const m = deal.metrics || {}
                return (
                  <tr
                    key={deal.id}
                    onClick={() => onNavigateToDeal(deal.id)}
                    className="border-b border-cw-border/50 hover:bg-cw-hover cursor-pointer"
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {deal.starred && <Star className="w-3 h-3 text-cw-yellow fill-cw-yellow" />}
                        <RiskIndicator risk={deal.risk} />
                        <span className="font-medium">{deal.name}</span>
                      </div>
                      <div className="text-xs text-gray-500">{deal.city}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-400">{deal.state}</td>
                    <td className="px-3 py-2 text-gray-400">{deal.units}</td>
                    <td className="px-3 py-2 text-gray-400">
                      {deal.purchase_price ? `$${(deal.purchase_price / 1e6).toFixed(1)}M` : '—'}
                    </td>
                    <td className={`px-3 py-2 ${m.going_in_cap_rate >= 0.055 ? 'text-cw-green' : m.going_in_cap_rate >= 0.045 ? 'text-cw-yellow' : m.going_in_cap_rate ? 'text-cw-red' : 'text-gray-600'}`}>
                      {m.going_in_cap_rate ? `${(m.going_in_cap_rate * 100).toFixed(2)}%` : '—'}
                    </td>
                    <td className={`px-3 py-2 ${m.dscr >= 1.25 ? 'text-cw-green' : m.dscr >= 1.15 ? 'text-cw-yellow' : m.dscr ? 'text-cw-red' : 'text-gray-600'}`}>
                      {m.dscr ? `${m.dscr.toFixed(2)}x` : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-400">
                      {m.price_per_unit ? `$${(m.price_per_unit / 1000).toFixed(0)}k` : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-400">
                      {m.cash_on_cash ? `${(m.cash_on_cash * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-400">
                      {m.levered_irr ? `${(m.levered_irr * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        deal.status === 'shortlisted' ? 'bg-yellow-600/20 text-cw-yellow' :
                        deal.status === 'closed' ? 'bg-green-600/20 text-cw-green' :
                        (deal.status === 'killed' || deal.status === 'dead') ? 'bg-red-600/20 text-cw-red' :
                        'bg-gray-600/20 text-gray-400'
                      }`}>
                        {deal.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {sortedDeals.length === 0 && (
            <div className="text-center text-gray-500 py-12">No deals match your filters</div>
          )}
        </div>
      )}
    </div>
  )
}
