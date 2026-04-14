import React, { useState, useEffect, useMemo } from 'react'
import {
  ClipboardList, BookOpen, Brain, User, FolderGit2, MessageSquare,
  Link as LinkIcon, Search, ChevronDown, ChevronRight, FileText,
} from 'lucide-react'

const TYPE_META = {
  feedback: { label: 'Feedback', icon: MessageSquare, color: 'text-cw-yellow', badge: 'bg-cw-yellow/10 text-cw-yellow' },
  user:     { label: 'User',     icon: User,                 color: 'text-cw-accent', badge: 'bg-cw-accent/10 text-cw-accent' },
  project:  { label: 'Project',  icon: FolderGit2,           color: 'text-cw-green',  badge: 'bg-cw-green/10 text-cw-green' },
  reference:{ label: 'Reference',icon: LinkIcon,             color: 'text-purple-400',badge: 'bg-purple-400/10 text-purple-400' },
  unknown:  { label: 'Other',    icon: FileText,             color: 'text-gray-400',  badge: 'bg-gray-400/10 text-gray-400' },
}

const TYPE_ORDER = ['feedback', 'reference', 'project', 'user', 'unknown']

// 9-step underwriting workflow — mirrors deal-analyst orchestrator + deal-state.json sections.
// Keep this in sync with Dev Agent/skills/deal-analyst/SKILL.md.
const WORKFLOW_STEPS = [
  { n: '1',   title: 'Zoning & Entitlements',     skill: 'zoning-analysis',       writes: 'step_1_zoning' },
  { n: '2',   title: 'Site Conditions',           skill: 'site-analysis',         writes: 'step_2_site' },
  { n: '3',   title: 'Market & Rent Comps',       skill: 'market-rent-comps',     writes: 'step_3_market' },
  { n: '3.5', title: 'Strategy Screen',           skill: 'strategy-screen',       writes: 'step_3_5_strategy_screen' },
  { n: '4',   title: 'Unit Mix & Program',        skill: 'unit-mix-program',      writes: 'step_4_unit_mix' },
  { n: '5',   title: 'NOI Underwriting',          skill: 'noi-underwriting',      writes: 'step_5_noi' },
  { n: '6',   title: 'Development Costs',         skill: 'dev-cost-estimate',     writes: 'step_6_dev_costs' },
  { n: '7',   title: 'Financing Analysis',        skill: 'financing-analysis',    writes: 'step_7_financing' },
  { n: '8',   title: 'Returns & Feasibility',     skill: 'returns-feasibility',   writes: 'step_8_returns' },
  { n: '9',   title: 'Strategy & Recommendation', skill: 'strategy-recommendation', writes: 'step_9_strategy' },
]

function Collapsible({ title, subtitle, icon: Icon, iconColor, badge, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-cw-card border border-cw-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 hover:bg-cw-hover text-left"
      >
        {open ? <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />}
        {Icon && <Icon className={`w-4 h-4 shrink-0 ${iconColor || 'text-gray-400'}`} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-white text-sm">{title}</span>
            {badge}
          </div>
          {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
        </div>
      </button>
      {open && (
        <div className="border-t border-cw-border p-4 bg-black/20">
          {children}
        </div>
      )}
    </div>
  )
}

function MarkdownBlock({ text }) {
  return (
    <pre className="whitespace-pre-wrap text-xs text-gray-300 font-mono leading-relaxed">{text}</pre>
  )
}

export default function Underwriting() {
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/underwriting.json', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setDoc)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const skills = doc?.skills || []
  const memories = doc?.memories || []

  const typeCounts = useMemo(() => {
    const c = { all: memories.length }
    for (const m of memories) c[m.type] = (c[m.type] || 0) + 1
    return c
  }, [memories])

  const filteredMems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return memories.filter((m) => {
      if (activeType !== 'all' && m.type !== activeType) return false
      if (!q) return true
      return (m.name + ' ' + m.description + ' ' + m.content).toLowerCase().includes(q)
    })
  }, [memories, activeType, query])

  const groupedMems = useMemo(() => {
    const g = {}
    for (const m of filteredMems) {
      if (!g[m.type]) g[m.type] = []
      g[m.type].push(m)
    }
    return g
  }, [filteredMems])

  const filteredSkills = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return skills
    return skills.filter((s) =>
      (s.name + ' ' + s.description + ' ' + s.skill_md + ' ' + (s.references || []).map((r) => r.content).join(' '))
        .toLowerCase().includes(q)
    )
  }, [skills, query])

  if (loading) return <div className="p-6 text-gray-500">Loading underwriting checklist…</div>
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-cw-red/10 border border-cw-red/40 rounded-xl p-4 text-sm text-cw-red">
          Failed to load underwriting.json: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList className="w-5 h-5 text-cw-accent" />
          <h1 className="text-2xl font-bold">Underwriting Checklist</h1>
        </div>
        <p className="text-sm text-gray-400 max-w-3xl">
          The skills, references, and memory the dev agent runs through when underwriting a deal from scratch.
          This is a snapshot — the working source lives in the agent's skill and memory folders.
        </p>
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
          <span>Version {doc?.version ?? '—'}</span>
          <span>•</span>
          <span>Last updated {doc?.last_updated ?? '—'}</span>
          <span>•</span>
          <span>{skills.length} skill{skills.length === 1 ? '' : 's'}</span>
          <span>•</span>
          <span>{memories.length} memory files</span>
        </div>
      </div>

      {/* 9-step workflow map */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="w-4 h-4 text-cw-green" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Workflow</h2>
          <span className="text-xs text-gray-500">deal-analyst orchestrates these in order</span>
        </div>
        <div className="bg-cw-card border border-cw-border rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {WORKFLOW_STEPS.map((step) => {
              const hasSkill = skills.some((s) => s.id === step.skill)
              return (
                <button
                  key={step.n}
                  onClick={() => setQuery(step.skill)}
                  className="text-left bg-cw-dark border border-cw-border rounded-lg p-3 hover:border-cw-accent transition-colors"
                  title={`Filter to ${step.skill}`}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-cw-accent font-mono text-xs">Step {step.n}</span>
                    {!hasSkill && (
                      <span className="text-[10px] text-cw-yellow" title="Skill not found in snapshot">missing</span>
                    )}
                  </div>
                  <div className="text-sm text-white font-medium mt-0.5">{step.title}</div>
                  <div className="text-[10px] text-gray-500 font-mono mt-1 truncate">{step.skill}</div>
                  <div className="text-[10px] text-gray-600 font-mono truncate">→ {step.writes}</div>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search skills, references, memory…"
          className="w-full pl-9 pr-3 py-2 bg-cw-card border border-cw-border rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cw-accent"
        />
      </div>

      {/* Skills section */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-cw-accent" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Skills</h2>
          <span className="text-xs text-gray-500">({filteredSkills.length})</span>
        </div>
        <div className="space-y-3">
          {filteredSkills.map((s) => (
            <div key={s.id} className="bg-cw-card border border-cw-border rounded-xl overflow-hidden">
              <div className="p-5">
                <div className="flex items-start gap-3 mb-2">
                  <BookOpen className="w-5 h-5 text-cw-accent shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-white">{s.name}</h3>
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-cw-accent/10 text-cw-accent">Skill</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 font-mono">{s.id}</div>
                  </div>
                </div>
                {s.description && (
                  <p className="text-sm text-gray-300 mb-4">{s.description}</p>
                )}
                <div className="space-y-2">
                  <Collapsible
                    title="SKILL.md"
                    subtitle="Core workflow instructions"
                    icon={FileText}
                    iconColor="text-gray-400"
                  >
                    <MarkdownBlock text={s.skill_md} />
                  </Collapsible>
                  {(s.references || []).map((r) => (
                    <Collapsible
                      key={r.name}
                      title={r.name}
                      subtitle="Reference"
                      icon={FileText}
                      iconColor="text-gray-400"
                    >
                      <MarkdownBlock text={r.content} />
                    </Collapsible>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {filteredSkills.length === 0 && (
            <div className="text-center text-gray-500 py-8 text-sm">No skills match your search.</div>
          )}
        </div>
      </section>

      {/* Memory section */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-cw-yellow" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Memory</h2>
          <span className="text-xs text-gray-500">({filteredMems.length})</span>
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1 bg-cw-card border border-cw-border rounded-lg p-1 mb-4 w-fit flex-wrap">
          {['all', ...TYPE_ORDER.filter((t) => typeCounts[t])].map((t) => {
            const label = t === 'all' ? 'All' : TYPE_META[t]?.label || t
            const count = typeCounts[t] || 0
            return (
              <button
                key={t}
                onClick={() => setActiveType(t)}
                className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                  activeType === t ? 'bg-cw-accent/20 text-cw-accent' : 'text-gray-400 hover:text-white'
                }`}
              >
                {label} <span className="text-gray-600">({count})</span>
              </button>
            )
          })}
        </div>

        {filteredMems.length === 0 ? (
          <div className="text-center text-gray-500 py-8 text-sm">No memory files match your filters.</div>
        ) : (
          <div className="space-y-6">
            {TYPE_ORDER.filter((t) => groupedMems[t]?.length).map((t) => {
              const meta = TYPE_META[t] || TYPE_META.unknown
              const Icon = meta.icon
              return (
                <div key={t}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                    <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">{meta.label}</h3>
                    <span className="text-xs text-gray-500">({groupedMems[t].length})</span>
                  </div>
                  <div className="space-y-2">
                    {groupedMems[t].map((m) => (
                      <Collapsible
                        key={m.file}
                        title={m.name}
                        subtitle={m.description}
                        icon={meta.icon}
                        iconColor={meta.color}
                        badge={<span className={`px-2 py-0.5 rounded text-[10px] font-medium ${meta.badge}`}>{meta.label}</span>}
                      >
                        <div className="text-[10px] text-gray-600 font-mono mb-2">{m.file}</div>
                        <MarkdownBlock text={m.content} />
                      </Collapsible>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
