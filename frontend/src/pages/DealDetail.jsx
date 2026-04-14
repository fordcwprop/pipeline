import React, { useState, useEffect } from 'react'
import { api } from '../api'
import { ArrowLeft, Star, Save, AlertTriangle, CheckCircle, XCircle, TrendingUp, Building2, DollarSign, Calendar, Edit3, Shield, FileText, Users, Clock, MapPin, ChevronDown, ChevronRight, Map, LineChart, Home, Calculator, Landmark, Target, Briefcase } from 'lucide-react'

const STATUSES = ['sourced', 'under_review', 'modeled', 'shortlisted', 'under_contract', 'closed', 'dead']

function MetricCard({ label, value, sub, good, warn }) {
  let color = 'text-white'
  if (good !== undefined) {
    color = good ? 'text-cw-green' : warn ? 'text-cw-yellow' : 'text-cw-red'
  }
  return (
    <div className="bg-cw-dark rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  )
}

function RiskBadge({ risk }) {
  if (!risk) return null
  const colors = { low: 'bg-green-900/50 text-cw-green border-green-800', medium: 'bg-yellow-900/50 text-cw-yellow border-yellow-800', high: 'bg-red-900/50 text-cw-red border-red-800' }
  return (
    <div className={`rounded-lg border p-3 ${colors[risk.level] || ''}`}>
      <div className="flex items-center gap-2 mb-2">
        {risk.level === 'low' ? <CheckCircle className="w-4 h-4" /> : risk.level === 'high' ? <XCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
        <span className="text-sm font-semibold">Risk Score: {risk.score}/10 ({risk.level})</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {risk.factors.map((f, i) => (
          <span key={i} className={`text-xs px-2 py-0.5 rounded ${f.type === 'positive' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
            {f.text}
          </span>
        ))}
      </div>
    </div>
  )
}

function Section({ title, children, icon: Icon }) {
  return (
    <div className="bg-cw-card border border-cw-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="w-4 h-4 text-gray-400" />}
        <h3 className="text-sm font-semibold text-gray-400">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function RiskLevelBadge({ level }) {
  const config = {
    low: { bg: 'bg-green-900/40', text: 'text-green-400', border: 'border-green-700', label: 'LOW' },
    moderate: { bg: 'bg-yellow-900/40', text: 'text-yellow-400', border: 'border-yellow-700', label: 'MODERATE' },
    high: { bg: 'bg-orange-900/40', text: 'text-orange-400', border: 'border-orange-700', label: 'HIGH' },
    very_high: { bg: 'bg-red-900/40', text: 'text-red-400', border: 'border-red-700', label: 'VERY HIGH' },
  }
  const c = config[level] || config.moderate
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      {c.label}
    </span>
  )
}

function EntitlementHistory({ data }) {
  if (!data) return null
  let ent
  try {
    ent = typeof data === 'string' ? JSON.parse(data) : data
  } catch { return null }
  if (!ent || (!ent.case_number && !ent.comparable_cases?.length && !ent.political_risk_rating)) return null

  const opp = ent.opposition_summary || {}

  return (
    <div className="bg-cw-card border border-cw-border rounded-xl p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-400">Entitlement History</h3>
        </div>
        {ent.political_risk_rating && <RiskLevelBadge level={ent.political_risk_rating} />}
      </div>

      {/* Case Summary */}
      {ent.case_number && (
        <div className="bg-cw-dark rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-3.5 h-3.5 text-cw-accent" />
            <span className="text-sm font-semibold text-white">Case {ent.case_number}</span>
            {ent.approval_date && <span className="text-xs text-gray-500">Approved {ent.approval_date}</span>}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {ent.filing_date && (
              <><div className="text-gray-500">Filed</div><div>{ent.filing_date}</div></>
            )}
            {ent.approval_body && (
              <><div className="text-gray-500">Approval Body</div><div>{ent.approval_body}</div></>
            )}
            {ent.original_request && (
              <><div className="text-gray-500">Original Request</div><div>{ent.original_request}</div></>
            )}
            {ent.final_approval && (
              <><div className="text-gray-500">Final Approval</div><div className="text-cw-green font-medium">{ent.final_approval}</div></>
            )}
            {ent.timeline_months && (
              <><div className="text-gray-500">Timeline</div><div>{ent.timeline_months} months</div></>
            )}
            {ent.vote && (
              <><div className="text-gray-500">Vote</div><div>{ent.vote}</div></>
            )}
          </div>

          {ent.original_vs_final_delta && (
            <div className="mt-2 p-2.5 bg-yellow-900/20 border border-yellow-800/40 rounded-lg">
              <div className="text-xs font-semibold text-yellow-400 mb-1">What Changed</div>
              <p className="text-xs text-gray-300 leading-relaxed">{ent.original_vs_final_delta}</p>
            </div>
          )}
        </div>
      )}

      {/* Conditions */}
      {ent.conditions_imposed?.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Conditions of Approval</div>
          <div className="space-y-1.5">
            {ent.conditions_imposed.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-cw-accent mt-0.5 shrink-0">•</span>
                <span className="text-gray-300">{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opposition */}
      {(opp.level || opp.primary_objections?.length > 0) && (
        <div className="bg-cw-dark rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Public Opposition</span>
            {opp.level && <RiskLevelBadge level={opp.level === 'hostile' ? 'very_high' : opp.level === 'organized' ? 'high' : opp.level === 'minimal' || opp.level === 'none' ? 'low' : 'moderate'} />}
          </div>

          <div className="space-y-2 text-sm">
            {opp.primary_objections?.length > 0 && (
              <div>
                <span className="text-gray-500">Key Objections: </span>
                <span className="text-gray-300">{opp.primary_objections.join(' · ')}</span>
              </div>
            )}
            {opp.organized_groups?.length > 0 && (
              <div>
                <span className="text-gray-500">Organized Groups: </span>
                <span className="text-gray-300">{opp.organized_groups.join(', ')}</span>
              </div>
            )}
            {(opp.speakers_for !== null && opp.speakers_for !== undefined || opp.speakers_against !== null && opp.speakers_against !== undefined) && (
              <div className="flex gap-4">
                {opp.speakers_for !== null && opp.speakers_for !== undefined && <span className="text-gray-300"><span className="text-green-400 font-medium">{opp.speakers_for}</span> spoke for</span>}
                {opp.speakers_against !== null && opp.speakers_against !== undefined && <span className="text-gray-300"><span className="text-red-400 font-medium">{opp.speakers_against}</span> spoke against</span>}
              </div>
            )}
            {opp.notes && <p className="text-xs text-gray-400 mt-1">{opp.notes}</p>}
          </div>
        </div>
      )}

      {/* Political Context */}
      {ent.political_context && (
        <div>
          <div className="text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Political Context</div>
          <p className="text-sm text-gray-300 leading-relaxed">{ent.political_context}</p>
        </div>
      )}

      {/* Comparable Cases */}
      {ent.comparable_cases?.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Comparable Rezonings</span>
          </div>
          <div className="space-y-2">
            {ent.comparable_cases.map((comp, i) => {
              const outcomeColor = comp.final_outcome === 'approved' ? 'text-green-400' : comp.final_outcome === 'denied' ? 'text-red-400' : 'text-yellow-400'
              return (
                <div key={i} className="bg-cw-dark rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{comp.location || comp.case_number || `Comp ${i + 1}`}</span>
                      {comp.product_type && <span className="text-xs text-gray-500 bg-cw-hover px-1.5 py-0.5 rounded">{comp.product_type}</span>}
                    </div>
                    <span className={`text-xs font-semibold uppercase ${outcomeColor}`}>{comp.final_outcome || '—'}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400">
                    {comp.units && <span>{comp.units} units</span>}
                    {comp.density_upa && <span>{comp.density_upa} u/ac</span>}
                    {comp.timeline_months && <span>{comp.timeline_months} mo timeline</span>}
                    {comp.opposition_level && <span>Opposition: {comp.opposition_level}</span>}
                    {comp.current_status && <span>{comp.current_status}</span>}
                  </div>
                  {comp.notes && <p className="text-xs text-gray-500 mt-1">{comp.notes}</p>}
                  {comp.post_approval_land_sale?.per_unit && (
                    <div className="text-xs text-cw-accent mt-1">Land traded: ${comp.post_approval_land_sale.per_unit.toLocaleString()}/unit</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Risk Notes */}
      {ent.political_risk_notes && (
        <div className="p-3 bg-cw-dark rounded-lg border-l-2 border-cw-yellow">
          <div className="text-xs font-semibold text-cw-yellow mb-1">Risk Assessment</div>
          <p className="text-xs text-gray-300 leading-relaxed">{ent.political_risk_notes}</p>
        </div>
      )}

      {/* Sources */}
      {ent.sources?.length > 0 && (
        <div className="border-t border-cw-border pt-3">
          <div className="text-xs text-gray-600 space-y-1">
            {ent.sources.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-gray-600">{s.type?.replace(/_/g, ' ') || 'source'}</span>
                {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-cw-accent hover:underline truncate">{s.url}</a>}
                {s.date && <span className="text-gray-700 shrink-0">{s.date}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StepSection({ title, icon: Icon, data, stepKey }) {
  const [open, setOpen] = useState(false)
  if (!data) return null
  let parsed
  try {
    parsed = typeof data === 'string' ? JSON.parse(data) : data
  } catch {
    return (
      <div className="bg-cw-card border border-cw-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          {Icon && <Icon className="w-4 h-4 text-gray-400" />}
          <h3 className="text-sm font-semibold text-gray-400">{title}</h3>
          <span className="ml-auto text-xs text-cw-red">invalid JSON</span>
        </div>
        <pre className="text-xs text-gray-500 overflow-x-auto">{String(data).slice(0, 500)}</pre>
      </div>
    )
  }
  if (!parsed || (typeof parsed === 'object' && Object.keys(parsed).length === 0)) return null

  const confidence = parsed.confidence || parsed.confidence_tier
  const summary = parsed.summary || parsed.recommendation || parsed.headline

  return (
    <div className="bg-cw-card border border-cw-border rounded-xl">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 p-4 text-left hover:bg-cw-hover/30 transition-colors rounded-xl"
      >
        {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        {Icon && <Icon className="w-4 h-4 text-gray-400" />}
        <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
        {confidence && (
          <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-cw-dark border border-cw-border text-gray-400">
            {confidence}
          </span>
        )}
        {summary && !open && (
          <span className="ml-2 text-xs text-gray-500 truncate max-w-md">{summary}</span>
        )}
        <span className="ml-auto text-[10px] text-gray-600 font-mono">{stepKey}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <pre className="text-xs text-gray-300 bg-cw-dark rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
{JSON.stringify(parsed, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

function StepBlock({ n, title, icon: Icon, children }) {
  return (
    <div className="bg-cw-card border border-cw-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-cw-dark/40 border-b border-cw-border">
        <span className="text-[11px] font-mono text-cw-accent uppercase tracking-wider shrink-0">Step {n}</span>
        {Icon && <Icon className="w-4 h-4 text-gray-400" />}
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  )
}

function FieldGrid({ rows }) {
  const visible = rows.filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (!visible.length) return null
  return (
    <div className="grid grid-cols-2 gap-y-2 text-sm">
      {visible.map(([label, val, emphasize]) => (
        <React.Fragment key={label}>
          <div className="text-gray-500">{label}</div>
          <div className={emphasize ? 'font-medium text-cw-accent' : ''}>{val}</div>
        </React.Fragment>
      ))}
    </div>
  )
}

function UnitMixTable({ data }) {
  if (!data) return null
  let rows
  try {
    rows = typeof data === 'string' ? JSON.parse(data) : data
  } catch { return null }
  if (!Array.isArray(rows) || rows.length === 0) return null
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-cw-border">
            <th className="py-2 pr-4 font-medium">Type</th>
            <th className="py-2 pr-4 font-medium">Count</th>
            <th className="py-2 pr-4 font-medium">Avg SF</th>
            <th className="py-2 pr-4 font-medium">Avg Rent</th>
            <th className="py-2 pr-4 font-medium">Rent/SF</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-cw-border/50">
              <td className="py-2 pr-4">{r.type || '—'}</td>
              <td className="py-2 pr-4">{r.count ?? '—'}</td>
              <td className="py-2 pr-4">{r.avg_sf ? r.avg_sf.toLocaleString() : '—'}</td>
              <td className="py-2 pr-4">{r.avg_rent ? `$${r.avg_rent.toLocaleString()}` : '—'}</td>
              <td className="py-2 pr-4 text-gray-400">
                {r.avg_sf && r.avg_rent ? `$${(r.avg_rent / r.avg_sf).toFixed(2)}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DealDetail({ dealId, onBack }) {
  const [deal, setDeal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editNotes, setEditNotes] = useState(false)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!dealId) return
    setLoading(true)
    api.getDeal(dealId)
      .then(d => { setDeal(d); setNotes(d.notes || '') })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [dealId])

  const updateField = async (field, value) => {
    setSaving(true)
    try {
      const updated = await api.updateDeal(dealId, { [field]: value })
      setDeal(updated)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const saveNotes = async () => {
    await updateField('notes', notes)
    setEditNotes(false)
  }

  if (loading || !deal) {
    return <div className="p-8 flex items-center justify-center h-full"><div className="text-gray-500">Loading deal...</div></div>
  }

  const m = deal.metrics || {}
  const fmt = (v, suffix = '') => v ? `${v}${suffix}` : '—'
  const fmtPct = (v) => v ? `${(v * 100).toFixed(2)}%` : '—'
  const fmtMoney = (v) => v ? `$${v.toLocaleString()}` : '—'
  const fmtMoneyM = (v) => v ? `$${(v / 1e6).toFixed(2)}M` : '—'

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-cw-hover transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{deal.name}</h1>
            <button onClick={() => updateField('starred', deal.starred ? 0 : 1)} className="p-1">
              <Star className={`w-5 h-5 ${deal.starred ? 'text-cw-yellow fill-cw-yellow' : 'text-gray-600'}`} />
            </button>
            {saving && <span className="text-xs text-gray-500">Saving...</span>}
          </div>
          <div className="text-sm text-gray-500 mt-0.5">
            {[deal.address, deal.city, deal.state].filter(Boolean).join(', ')}
            {deal.submarket ? ` · ${deal.submarket}` : ''}
          </div>
        </div>
        <select
          value={deal.status}
          onChange={e => updateField('status', e.target.value)}
          className="bg-cw-dark border border-cw-border rounded-lg px-3 py-2 text-sm"
        >
          {STATUSES.map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Risk Assessment */}
      <RiskBadge risk={deal.risk} />

      {/* Key Metrics */}
      <Section title="Key Metrics" icon={TrendingUp}>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <MetricCard label="Going-in Cap" value={fmtPct(m.going_in_cap_rate)} good={m.going_in_cap_rate >= 0.055} warn={m.going_in_cap_rate >= 0.045} />
          <MetricCard label="DSCR" value={m.dscr ? `${m.dscr.toFixed(2)}x` : '—'} good={m.dscr >= 1.25} warn={m.dscr >= 1.15} />
          <MetricCard label="Cash-on-Cash" value={fmtPct(m.cash_on_cash)} good={m.cash_on_cash >= 0.06} warn={m.cash_on_cash >= 0.04} />
          <MetricCard label="Levered IRR" value={fmtPct(m.levered_irr)} good={m.levered_irr >= 0.13} warn={m.levered_irr >= 0.10} />
          <MetricCard label="Equity Multiple" value={m.equity_multiple ? `${m.equity_multiple.toFixed(2)}x` : '—'} good={m.equity_multiple >= 1.8} warn={m.equity_multiple >= 1.5} />
          <MetricCard label="NOI" value={fmtMoney(m.noi)} />
          <MetricCard label="Price / Unit" value={fmtMoney(m.price_per_unit)} />
          <MetricCard label="Price / SF" value={fmtMoney(m.price_per_sf)} />
          <MetricCard label="Yield on Cost" value={fmtPct(m.yield_on_cost)} />
          <MetricCard label="Expense Ratio" value={fmtPct(m.expense_ratio)} />
        </div>
      </Section>

      {/* Summary row: Property · Broker · Timeline */}
      <div className="grid md:grid-cols-3 gap-6">
        <Section title="Property" icon={Building2}>
          <FieldGrid rows={[
            ['Units', deal.units],
            ['Total SF', deal.total_sf ? deal.total_sf.toLocaleString() : null],
            ['Year Built', deal.year_built],
            ['Type', deal.property_type && <span className="capitalize">{deal.property_type}</span>],
            ['Deal Type', deal.deal_type && <span className="capitalize">{deal.deal_type}</span>],
          ]} />
        </Section>
        <Section title="Broker" icon={Users}>
          <FieldGrid rows={[
            ['Name', deal.broker_name],
            ['Company', deal.broker_company],
            ['Email', deal.broker_email],
            ['Phone', deal.broker_phone],
          ]} />
        </Section>
        <Section title="Timeline" icon={Calendar}>
          <FieldGrid rows={[
            ['Listed', deal.date_listed],
            ['CFO', deal.date_cfo],
            ['Best & Final', deal.date_best_final],
            ['LOI Submitted', deal.date_loi_submitted],
            ['LOI Accepted', deal.date_loi_accepted],
            ['DD Start', deal.date_dd_start],
            ['DD End', deal.date_dd_end],
            ['Closing', deal.date_closing],
          ]} />
        </Section>
      </div>

      {/* 9-Step Underwriting */}
      <div className="space-y-4">
        <StepBlock n="1" title="Zoning & Entitlements" icon={Shield}>
          <EntitlementHistory data={deal.entitlement_data} />
          <StepSection title="Zoning output" icon={FileText} data={deal.zoning_data} stepKey="step_1_zoning" />
          {!deal.entitlement_data && !deal.zoning_data && (
            <p className="text-sm text-gray-600 italic">No zoning analysis yet.</p>
          )}
        </StepBlock>

        <StepBlock n="2" title="Site Conditions" icon={Map}>
          <StepSection title="Site output" icon={FileText} data={deal.site_data} stepKey="step_2_site" />
          {!deal.site_data && <p className="text-sm text-gray-600 italic">No site analysis yet.</p>}
        </StepBlock>

        <StepBlock n="3" title="Market & Rent Comps" icon={LineChart}>
          <StepSection title="Market output" icon={FileText} data={deal.market_data} stepKey="step_3_market" />
          {!deal.market_data && <p className="text-sm text-gray-600 italic">No market analysis yet.</p>}
        </StepBlock>

        <StepBlock n="3.5" title="Strategy Screen" icon={Target}>
          <StepSection title="Strategy screen output" icon={FileText} data={deal.strategy_screen_data} stepKey="step_3_5_strategy_screen" />
          {!deal.strategy_screen_data && <p className="text-sm text-gray-600 italic">No strategy screen yet.</p>}
        </StepBlock>

        <StepBlock n="4" title="Unit Mix & Program" icon={Users}>
          <UnitMixTable data={deal.unit_mix} />
          {!deal.unit_mix && <p className="text-sm text-gray-600 italic">No unit mix yet.</p>}
        </StepBlock>

        <StepBlock n="5" title="NOI Underwriting" icon={Calculator}>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Revenue</div>
              <FieldGrid rows={[
                ['Gross Potential Rent', fmtMoney(deal.gross_potential_rent)],
                ['Vacancy Rate', deal.vacancy_rate != null ? fmtPct(deal.vacancy_rate) : null],
                ['Other Income / Unit', deal.other_income_per_unit ? fmtMoney(deal.other_income_per_unit) : null],
                ['Concessions / Unit', deal.concessions_per_unit ? fmtMoney(deal.concessions_per_unit) : null],
              ]} />
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Expenses</div>
              <FieldGrid rows={[
                ['Taxes', deal.taxes ? fmtMoney(deal.taxes) : null],
                ['Insurance', deal.insurance ? fmtMoney(deal.insurance) : null],
                ['Utilities', deal.utilities ? fmtMoney(deal.utilities) : null],
                ['Repairs & Maint.', deal.repairs_maintenance ? fmtMoney(deal.repairs_maintenance) : null],
                ['Mgmt Fee %', deal.management_fee_pct != null ? fmtPct(deal.management_fee_pct) : null],
                ['Admin', deal.admin ? fmtMoney(deal.admin) : null],
                ['Payroll', deal.payroll ? fmtMoney(deal.payroll) : null],
                ['Marketing', deal.marketing ? fmtMoney(deal.marketing) : null],
                ['Capex Reserve / Unit', deal.capex_reserve_per_unit ? fmtMoney(deal.capex_reserve_per_unit) : null],
                ['Total Exp Override', deal.total_expenses_override ? fmtMoney(deal.total_expenses_override) : null],
              ]} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            <MetricCard label="NOI" value={fmtMoney(m.noi)} />
            <MetricCard label="Expense Ratio" value={fmtPct(m.expense_ratio)} />
            <MetricCard label="NOI / Unit" value={m.noi && deal.units ? fmtMoney(Math.round(m.noi / deal.units)) : '—'} />
            <MetricCard label="Going-in Cap" value={fmtPct(m.going_in_cap_rate)} />
          </div>
          <StepSection title="NOI output" icon={FileText} data={deal.noi_data} stepKey="step_5_noi" />
        </StepBlock>

        <StepBlock n="6" title="Development & Acquisition Costs" icon={Home}>
          <FieldGrid rows={[
            ['Purchase Price', fmtMoney(deal.purchase_price)],
            ['Closing Costs', fmtMoney(deal.closing_costs)],
            ['Capex Budget', fmtMoney(deal.capex_budget)],
            ['Total Basis', fmtMoney(m.total_basis), true],
            ['Price / Unit', fmtMoney(m.price_per_unit)],
            ['Price / SF', fmtMoney(m.price_per_sf)],
          ]} />
          <StepSection title="Dev-cost output" icon={FileText} data={deal.dev_cost_data} stepKey="step_6_dev_costs" />
        </StepBlock>

        <StepBlock n="7" title="Financing" icon={Landmark}>
          <FieldGrid rows={[
            ['LTV', deal.ltv != null ? fmtPct(deal.ltv) : null],
            ['Loan Amount', fmtMoney(m.loan_amount)],
            ['Equity Required', fmtMoney(m.equity), true],
            ['Interest Rate', deal.interest_rate != null ? fmtPct(deal.interest_rate) : null],
            ['Amortization', deal.amortization_years ? `${deal.amortization_years} years` : null],
            ['IO Period', deal.io_period_months ? `${deal.io_period_months} months` : 'None'],
            ['Loan Term', deal.loan_term_years ? `${deal.loan_term_years} years` : null],
            ['Annual Debt Service', fmtMoney(m.annual_debt_service)],
            ['DSCR', m.dscr ? `${m.dscr.toFixed(2)}x` : null],
          ]} />
          <StepSection title="Financing output" icon={FileText} data={deal.financing_data} stepKey="step_7_financing" />
        </StepBlock>

        <StepBlock n="8" title="Returns & Feasibility" icon={TrendingUp}>
          <FieldGrid rows={[
            ['Exit Cap Rate', deal.exit_cap_rate != null ? fmtPct(deal.exit_cap_rate) : null],
            ['Sale Costs %', deal.sale_costs_pct != null ? fmtPct(deal.sale_costs_pct) : null],
            ['Hold Period', deal.hold_period_years ? `${deal.hold_period_years} years` : null],
          ]} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            <MetricCard label="Yield on Cost" value={fmtPct(m.yield_on_cost)} good={m.yield_on_cost >= 0.065} warn={m.yield_on_cost >= 0.060} />
            <MetricCard label="Cash-on-Cash" value={fmtPct(m.cash_on_cash)} good={m.cash_on_cash >= 0.06} warn={m.cash_on_cash >= 0.04} />
            <MetricCard label="Levered IRR" value={fmtPct(m.levered_irr)} good={m.levered_irr >= 0.13} warn={m.levered_irr >= 0.10} />
            <MetricCard label="Equity Multiple" value={m.equity_multiple ? `${m.equity_multiple.toFixed(2)}x` : '—'} good={m.equity_multiple >= 1.8} warn={m.equity_multiple >= 1.5} />
          </div>
          <StepSection title="Returns output" icon={FileText} data={deal.returns_data} stepKey="step_8_returns" />
        </StepBlock>

        <StepBlock n="9" title="Strategy & Recommendation" icon={Briefcase}>
          {deal.summary && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Summary</div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{deal.summary}</p>
            </div>
          )}
          {deal.investment_thesis && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Investment Thesis</div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{deal.investment_thesis}</p>
            </div>
          )}
          {deal.risk_factors && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Risk Factors</div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{deal.risk_factors}</p>
            </div>
          )}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
              <Edit3 className="w-3 h-3" /> Notes
            </div>
            {editNotes ? (
              <div>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-cw-dark border border-cw-border rounded-lg p-3 text-sm text-white placeholder-gray-600 focus:border-cw-accent focus:outline-none min-h-[120px] resize-y"
                  placeholder="Add deal notes..."
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={saveNotes} className="px-3 py-1.5 bg-cw-accent text-white text-sm rounded-lg hover:bg-blue-600">
                    <Save className="w-3 h-3 inline mr-1" /> Save
                  </button>
                  <button onClick={() => { setNotes(deal.notes || ''); setEditNotes(false) }} className="px-3 py-1.5 text-gray-400 text-sm rounded-lg hover:bg-cw-hover">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div onClick={() => setEditNotes(true)} className="cursor-pointer hover:bg-cw-dark rounded-lg p-2 -m-2 transition-colors">
                {deal.notes ? (
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{deal.notes}</p>
                ) : (
                  <p className="text-sm text-gray-600 italic">Click to add notes...</p>
                )}
              </div>
            )}
          </div>
          <StepSection title="Strategy output" icon={FileText} data={deal.strategy_data} stepKey="step_9_strategy" />
        </StepBlock>
      </div>

      {/* Activity */}
      {deal.activity && deal.activity.length > 0 && (
        <Section title="Activity">
          <div className="space-y-2">
            {deal.activity.map(a => (
              <div key={a.id} className="flex items-center gap-3 text-xs py-1">
                <span className="text-gray-600 w-32 shrink-0">{new Date(a.created_at).toLocaleString()}</span>
                <span className="text-gray-300">{a.action.replace(/_/g, ' ')}</span>
                <span className="text-gray-500">{a.user_email}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
