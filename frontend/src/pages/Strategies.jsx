import React, { useState, useEffect, useMemo } from 'react'
import yaml from 'js-yaml'
import { BookOpen, Check, X, Home, Coins, Banknote, Download, ExternalLink, Search } from 'lucide-react'

const CATEGORY_META = {
  product: { label: 'Product', icon: Home, color: 'text-cw-accent', badge: 'bg-cw-accent/10 text-cw-accent' },
  capital: { label: 'Capital', icon: Coins, color: 'text-cw-yellow', badge: 'bg-cw-yellow/10 text-cw-yellow' },
  financing: { label: 'Financing', icon: Banknote, color: 'text-cw-green', badge: 'bg-cw-green/10 text-cw-green' },
  execution: { label: 'Execution', icon: BookOpen, color: 'text-purple-400', badge: 'bg-purple-400/10 text-purple-400' },
}

function fmt(v) {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

function StrategyCard({ s }) {
  const meta = CATEGORY_META[s.category] || CATEGORY_META.product
  const Icon = meta.icon
  return (
    <div className="bg-cw-card border border-cw-border rounded-xl p-5">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${meta.color}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-white">{s.name}</h3>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${meta.badge}`}>{meta.label}</span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5 font-mono">{s.id}</div>
          </div>
        </div>
      </div>

      {s.short_desc && (
        <p className="text-sm text-gray-300 mb-4">{s.short_desc}</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 text-xs">
        <div>
          <div className="text-gray-500 uppercase tracking-wide mb-0.5">Density</div>
          <div className="text-white font-mono">{fmt(s.typical_density)}</div>
        </div>
        <div>
          <div className="text-gray-500 uppercase tracking-wide mb-0.5">Product</div>
          <div className="text-white font-mono">{fmt(s.typical_product)}</div>
        </div>
        <div>
          <div className="text-gray-500 uppercase tracking-wide mb-0.5">Min Acres</div>
          <div className="text-white font-mono">{fmt(s.min_acreage)}</div>
        </div>
        <div>
          <div className="text-gray-500 uppercase tracking-wide mb-0.5">Max Acres</div>
          <div className="text-white font-mono">{fmt(s.max_acreage)}</div>
        </div>
        <div>
          <div className="text-gray-500 uppercase tracking-wide mb-0.5">Rent Floor</div>
          <div className="text-white font-mono">{s.rent_floor_psf != null ? `$${s.rent_floor_psf}/SF` : '—'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-cw-green uppercase tracking-wide mb-2">
            <Check className="w-3.5 h-3.5" /> Fit Criteria
          </div>
          <ul className="space-y-1.5">
            {(s.fit_criteria || []).map((c, i) => (
              <li key={i} className="text-xs text-gray-300 flex gap-2">
                <span className="text-cw-green shrink-0">+</span>
                <span>{c}</span>
              </li>
            ))}
            {(!s.fit_criteria || s.fit_criteria.length === 0) && (
              <li className="text-xs text-gray-600 italic">none specified</li>
            )}
          </ul>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-cw-red uppercase tracking-wide mb-2">
            <X className="w-3.5 h-3.5" /> Kill Criteria
          </div>
          <ul className="space-y-1.5">
            {(s.kill_criteria || []).map((c, i) => (
              <li key={i} className="text-xs text-gray-300 flex gap-2">
                <span className="text-cw-red shrink-0">−</span>
                <span>{c}</span>
              </li>
            ))}
            {(!s.kill_criteria || s.kill_criteria.length === 0) && (
              <li className="text-xs text-gray-600 italic">none specified</li>
            )}
          </ul>
        </div>
      </div>

      {s.notes && (
        <div className="mt-4 pt-4 border-t border-cw-border">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</div>
          <p className="text-xs text-gray-400 whitespace-pre-wrap">{s.notes}</p>
        </div>
      )}
    </div>
  )
}

export default function Strategies() {
  const [doc, setDoc] = useState(null)
  const [raw, setRaw] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    fetch('/strategies.yaml', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      .then((text) => {
        setRaw(text)
        const parsed = yaml.load(text)
        setDoc(parsed)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const strategies = doc?.strategies || []

  const categoryCounts = useMemo(() => {
    const counts = { all: strategies.length }
    for (const s of strategies) {
      counts[s.category] = (counts[s.category] || 0) + 1
    }
    return counts
  }, [strategies])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return strategies.filter((s) => {
      if (activeCategory !== 'all' && s.category !== activeCategory) return false
      if (!q) return true
      const hay = [
        s.id, s.name, s.short_desc, s.notes,
        ...(s.fit_criteria || []),
        ...(s.kill_criteria || []),
      ].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [strategies, activeCategory, query])

  const grouped = useMemo(() => {
    const g = {}
    for (const s of filtered) {
      if (!g[s.category]) g[s.category] = []
      g[s.category].push(s)
    }
    return g
  }, [filtered])

  const categoryOrder = ['product', 'capital', 'financing', 'execution']

  if (loading) {
    return (
      <div className="p-6 text-gray-500">Loading strategies…</div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-cw-red/10 border border-cw-red/40 rounded-xl p-4 text-sm text-cw-red">
          Failed to load strategies.yaml: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5 text-cw-accent" />
            <h1 className="text-2xl font-bold">Strategy Menu</h1>
          </div>
          <p className="text-sm text-gray-400">
            CWP's pre-approved strategies. The <code className="text-cw-accent">strategy-screen</code> skill evaluates each deal against these.
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span>Version {doc?.version ?? '—'}</span>
            <span>•</span>
            <span>Last updated {doc?.last_updated ?? '—'}</span>
            <span>•</span>
            <span>{strategies.length} strategies</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRaw((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-300 bg-cw-card border border-cw-border hover:bg-cw-hover"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {showRaw ? 'Hide raw YAML' : 'View raw YAML'}
          </button>
          <a
            href="/strategies.yaml"
            download="strategies.yaml"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-300 bg-cw-card border border-cw-border hover:bg-cw-hover"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </a>
        </div>
      </div>

      {/* Raw YAML panel */}
      {showRaw && (
        <pre className="bg-black border border-cw-border rounded-xl p-4 text-xs text-gray-300 overflow-auto mb-6 max-h-[60vh]">
{raw}
        </pre>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <div className="flex items-center gap-1 bg-cw-card border border-cw-border rounded-lg p-1">
          {['all', ...categoryOrder.filter((c) => categoryCounts[c])].map((cat) => {
            const label = cat === 'all' ? 'All' : CATEGORY_META[cat]?.label || cat
            const count = categoryCounts[cat] || 0
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                  activeCategory === cat
                    ? 'bg-cw-accent/20 text-cw-accent'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {label} <span className="text-gray-600">({count})</span>
              </button>
            )
          })}
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, criteria, notes…"
            className="w-full pl-9 pr-3 py-2 bg-cw-card border border-cw-border rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cw-accent"
          />
        </div>
      </div>

      {/* Strategy groups */}
      {filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No strategies match your filters.</div>
      ) : (
        <div className="space-y-8">
          {categoryOrder.filter((c) => grouped[c]?.length).map((cat) => {
            const meta = CATEGORY_META[cat]
            const Icon = meta.icon
            return (
              <section key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`w-4 h-4 ${meta.color}`} />
                  <h2 className="text-sm font-semibold text-white uppercase tracking-wide">{meta.label} Strategies</h2>
                  <span className="text-xs text-gray-500">({grouped[cat].length})</span>
                </div>
                <div className="space-y-3">
                  {grouped[cat].map((s) => (
                    <StrategyCard key={s.id} s={s} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
