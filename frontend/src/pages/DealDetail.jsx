import React, { useState, useEffect } from 'react'
import { api } from '../api'
import { ArrowLeft, Star, Save, AlertTriangle, CheckCircle, XCircle, TrendingUp, Building2, DollarSign, Calendar, Edit3, Shield, FileText, Users, Clock, MapPin, ChevronDown, ChevronRight, Map, LineChart, Home, Calculator, Landmark, Target, Briefcase } from 'lucide-react'
// SiteMap removed: react-leaflet@5 requires React 19; project uses React 18
function buildMapPropsFromDeal() { return null }

// Reverse Windows-1252 mojibake that occurs when UTF-8 bytes were decoded as
// cp1252 then re-stored. E.g. "â€"" → "—", "â€¢" → "•".
const W1252_TO_BYTE = {0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,0x017E:0x9E,0x0178:0x9F}
function fixMojibake(str) {
  if (typeof str !== 'string') return str
  try {
    const bytes = new Uint8Array(str.length)
    for (let i = 0; i < str.length; i++) {
      const cp = str.charCodeAt(i)
      const b = W1252_TO_BYTE[cp] ?? (cp < 0x100 ? cp : null)
      if (b === null) return str
      bytes[i] = b
    }
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return decoded !== str ? decoded : str
  } catch { return str }
}

const STATUSES = ['sourced', 'under_review', 'modeled', 'shortlisted', 'under_contract', 'closed', 'killed', 'dead']

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

// Hybrid acq+dev deals (e.g., Theo Allen Gateway: 270-unit mid-rise Phase 1
// in lease-up + 27.2 ac of entitled land for Phase 2 + residual lots) can't
// be flattened into a single step_4-9 snapshot. The dev-agent sync-pipeline
// skill detects them by the presence of phase1/phase2_revised top-level keys
// on deal-state.json and writes a phase_context blob. This component renders
// it as a two-column P1 vs P2 breakdown above Key Metrics. Returns null for
// non-hybrid deals so the page layout is unchanged.
function PhaseBreakdownCard({ data }) {
  if (!data) return null
  const pc = typeof data === 'string' ? (() => { try { return JSON.parse(data) } catch { return null } })() : data
  if (!pc || !pc.hybrid) return null

  const p1 = pc.phase_1 || {}
  const p2 = pc.phase_2 || {}
  const c = pc.combined || {}

  const fmtM = (v) => (v || v === 0) ? `$${(v / 1e6).toFixed(1)}M` : '—'
  const fmtN = (v) => (v || v === 0) ? v.toLocaleString() : '—'
  // Defensive: any percent stored as whole-number (e.g. yoc=5.66 meaning 5.66%)
  // is detected via |v| >= 1 and rendered as-is. Decimals (0.0566) are scaled x100.
  const fmtPct = (v) => {
    if (v === null || v === undefined || !isFinite(v)) return '—'
    if (v === 0) return '0.00%'
    if (Math.abs(v) >= 1) return `${Number(v).toFixed(2)}%`
    return `${(v * 100).toFixed(2)}%`
  }
  const fmtRange = (r) => (Array.isArray(r) && r.length === 2) ? `$${(r[0]/1e6).toFixed(1)}M – $${(r[1]/1e6).toFixed(1)}M` : '—'

  const Field = ({ label, value, span = 1 }) => (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold text-sm">{value}</div>
    </div>
  )

  return (
    <div className="bg-cw-card border border-cw-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-400">Phase Breakdown</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-indigo-900/40 text-indigo-300 ml-auto">hybrid acq + dev</span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Phase 1 — Acquisition */}
        <div className="bg-cw-dark rounded-lg p-4">
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-sm font-semibold text-white">{p1.label || 'Phase 1 — Acquisition'}</div>
            {p1.stage && <span className="text-xs px-2 py-0.5 rounded bg-blue-900/40 text-blue-300">{p1.stage}</span>}
          </div>
          <div className="grid grid-cols-2 gap-y-2 gap-x-3">
            <Field label="Units" value={fmtN(p1.units)} />
            <Field label="Rentable SF" value={fmtN(p1.rentable_sf)} />
            <Field label="Occupancy" value={p1.occupancy_pct != null ? `${p1.occupancy_pct}%` : '—'} />
            <Field label="In-Place GPR" value={fmtM(p1.in_place_gpr)} />
            <Field label="FY1 NOI" value={fmtM(p1.fy1_noi)} />
            <Field label="Stabilized NOI" value={fmtM(p1.stabilized_noi)} />
            <Field label="Basis Range" value={fmtRange(p1.basis_range)} span={2} />
            {p1.basis_mid != null && <Field label="Basis Mid" value={fmtM(p1.basis_mid)} span={2} />}
          </div>
          {p1.financing && (
            <div className="mt-3 pt-3 border-t border-cw-border">
              <div className="text-xs text-gray-500 mb-1">Financing — {p1.financing.product || 'TBD'}</div>
              <div className="text-sm">
                LTV <span className="font-semibold">{fmtPct(p1.financing.ltv)}</span>
                {' · '}Rate <span className="font-semibold">{fmtPct(p1.financing.rate)}</span>
                {p1.financing.term_yrs && <> · <span className="font-semibold">{p1.financing.term_yrs}yr</span></>}
                {p1.financing.io_years && <> · IO <span className="font-semibold">{p1.financing.io_years}yr</span></>}
              </div>
            </div>
          )}
        </div>

        {/* Phase 2 — Development */}
        <div className="bg-cw-dark rounded-lg p-4">
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-sm font-semibold text-white">{p2.label || 'Phase 2 — Development'}</div>
            <span className="text-xs px-2 py-0.5 rounded bg-purple-900/40 text-purple-300">development</span>
          </div>
          <div className="grid grid-cols-2 gap-y-2 gap-x-3">
            <Field label="Approved Units" value={fmtN(p2.approved_units)} />
            <Field label="Approved Ac" value={p2.approved_ac != null ? p2.approved_ac : '—'} />
            <Field label="Approved Product" value={p2.approved_product || '—'} span={2} />
            <Field label="Residual Ac" value={p2.residual_ac != null ? p2.residual_ac : '—'} />
            <Field label="Residual Unit Cap" value={fmtN(p2.residual_capacity_units)} />
            <Field label="Land Basis" value={fmtRange(p2.land_basis_range)} span={2} />
            {p2.residual_lots_range && <Field label="Residual Lots" value={fmtRange(p2.residual_lots_range)} span={2} />}
            {Array.isArray(p2.hard_cost_psf_range) && p2.hard_cost_psf_range.length === 2 && (
              <Field label="Hard Cost Market" value={`$${p2.hard_cost_psf_range[0]}–$${p2.hard_cost_psf_range[1]}/SF`} span={2} />
            )}
          </div>
          {p2.financing && (
            <div className="mt-3 pt-3 border-t border-cw-border">
              <div className="text-xs text-gray-500 mb-1">Financing</div>
              <div className="text-sm">
                Constr LTC <span className="font-semibold">{fmtPct(p2.financing.construction_ltc)}</span>
                {' @ '}<span className="font-semibold">{fmtPct(p2.financing.construction_rate)}</span>
              </div>
              <div className="text-sm">
                Perm LTV <span className="font-semibold">{fmtPct(p2.financing.perm_ltv)}</span>
                {' @ '}<span className="font-semibold">{fmtPct(p2.financing.perm_rate)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Combined */}
      {(c.combined_mid || c.total_basis_range || c.walk_above || c.bottom_line || c.opening_bid) && (
        <div className="mt-4 bg-cw-dark rounded-lg p-4">
          <div className="text-sm font-semibold text-white mb-2">Combined</div>
          <div className="grid md:grid-cols-3 gap-3">
            {c.total_basis_range && <Field label="Total Basis Range" value={fmtRange(c.total_basis_range)} />}
            {c.combined_mid != null && <Field label="Combined Mid" value={fmtM(c.combined_mid)} />}
            {c.walk_above != null && (
              <div>
                <div className="text-xs text-gray-500">Walk Above</div>
                <div className="font-semibold text-sm text-cw-red">{fmtM(c.walk_above)}</div>
              </div>
            )}
          </div>
          {c.opening_bid && (
            <div className="mt-3 text-sm">
              <span className="text-xs text-gray-500">Opening Bid: </span>
              {c.opening_bid}
            </div>
          )}
          {c.bottom_line && (
            <div className="mt-2 text-sm text-gray-300 italic">{c.bottom_line}</div>
          )}
        </div>
      )}
    </div>
  )
}

// Renders step_2b_demographics. Reads the `demographics_data` JSON blob written by
// the fordcwprop/dev-agent `demographics` sub-skill. Shows:
//   - Classification chip + narrative paragraph (top)
//   - 3-column comparison table (MSA / Submarket / Site tract) with current value,
//     5-yr % change, trend arrow, and level-vs-MSA percentile when available
//   - Hot / Cold map: lists of nearby areas in each category
//   - Special notes callout
//   - Submarket definition footer (method + what's included)
// Returns null for deals that haven't run step_2b yet.
function DemographicsCard({ data }) {
  const d = typeof data === 'string' ? (() => { try { return JSON.parse(data) } catch { return null } })() : data
  if (!d || (!d.areas && !d.msa && !d.narrative && !d.takeaway_for_site)) return null

  const areas = d.areas || { msa: d.msa, submarket: d.submarket, tract_local: d.tract_local }
  const hotCold = d.hot_cold_map || {}
  const special = Array.isArray(d.special_notes) ? d.special_notes : []
  const takeaway = d.takeaway_for_site || {}
  const sub = d.submarket_definition || {}

  // Metric display order + labels. Match SKILL.md metrics_tracked.
  const METRICS = [
    ['median_hh_income',          'Median HH Income',  'money'],
    ['population',               'Population',        'int'],
    ['pct_bachelors_plus',       "Bachelor's+",       'pct'],
    ['unemployment_rate',        'Unemployment',      'pct'],
    ['median_home_value',        'Median Home Value', 'money'],
    ['median_age',               'Median Age',        'num'],
    ['pct_owner_occupied',       'Owner-Occupied',    'pct'],
    ['poverty_rate',             'Poverty Rate',      'pct'],
  ]

  const fmt = (kind, v) => {
    if (v == null || v === '' || Number.isNaN(v)) return '—'
    const n = typeof v === 'number' ? v : (typeof v === 'object' && v !== null ? v.value : parseFloat(v))
    if (n == null || Number.isNaN(n)) return '—'
    if (kind === 'money') return n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : `$${Math.round(n).toLocaleString()}`
    if (kind === 'int')   return Math.round(n).toLocaleString()
    if (kind === 'pct')   return `${n.toFixed(1)}%`
    return n.toFixed(1)
  }

  const getMetric = (area, key) => {
    // Schema v2 (dev-agent step_2b output): area.metrics[key].{current, prior, change_pct, trend_label}
    // Per-area scalar percentile; trend_label per metric.
    const m = area?.metrics?.[key]
    if (m != null) {
      const curVal = m.current ?? m.value
      const priVal = m.prior
      const legacyPct = m.change_pct
      const label = m.trend_label
      const levelPct = area?.level_percentile_within_msa ?? area?.level_percentile_within_region
      return { curVal, priVal, ann: null, kind: 'level', label, levelPct, legacyPct }
    }
    // Schema v1 fallback: area.current[key], area.annualized[key], area.trend_labels[key]
    const cur = area?.current?.[key]
    const pri = area?.prior?.[key]
    const curVal = typeof cur === 'object' && cur !== null ? cur.value : cur
    const priVal = typeof pri === 'object' && pri !== null ? pri.value : pri
    const ann = area?.annualized?.[key]
    const kind = area?.change_kind?.[key] || 'level'
    const label = area?.trend_labels?.[key]
    const levelPct = area?.level_percentile_within_msa?.[key] ?? area?.level_percentile_within_region?.[key]
    const legacyPct = area?.change_pct?.[key]
    return { curVal, priVal, ann, kind, label, levelPct, legacyPct }
  }

  const TrendArrow = ({ label }) => {
    if (!label || label === 'unknown') return <span className="text-gray-500">—</span>
    const map = {
      booming: { icon: '▲▲', color: 'text-emerald-400' },
      up:      { icon: '▲',  color: 'text-green-400' },
      steady:  { icon: '●',  color: 'text-gray-400' },
      down:    { icon: '▼',  color: 'text-orange-400' },
      busting: { icon: '▼▼', color: 'text-red-400' },
    }
    const m = map[label] || { icon: '●', color: 'text-gray-400' }
    return <span className={`${m.color} text-xs`} title={label}>{m.icon}</span>
  }

  const PctPill = ({ p }) => {
    if (p == null) return null
    const color = p >= 80 ? 'bg-emerald-900/40 text-emerald-300'
                : p >= 60 ? 'bg-green-900/40 text-green-300'
                : p >= 40 ? 'bg-gray-700 text-gray-300'
                : p >= 20 ? 'bg-orange-900/40 text-orange-300'
                          : 'bg-red-900/40 text-red-300'
    return <span className={`text-[10px] px-1.5 py-0.5 rounded ${color}`}>{Math.round(p)}pctl</span>
  }

  // Format annualized change as "+2.41%/yr" for CAGR levels or "+0.58pp/yr" for rates
  const formatAnnualized = (ann, kind) => {
    if (ann == null) return null
    if (kind === 'rate') {
      const sign = ann > 0 ? '+' : ''
      return `${sign}${ann.toFixed(2)}pp/yr`
    }
    // level — ann is fractional (0.0241 = 2.41%/yr)
    const pct = ann * 100
    const sign = pct > 0 ? '+' : ''
    return `${sign}${pct.toFixed(2)}%/yr`
  }

  const classificationColors = {
    already_good:      'bg-emerald-900/40 text-emerald-300 border-emerald-800',
    adjacent_to_good:  'bg-green-900/40 text-green-300 border-green-800',
    path_of_growth:    'bg-blue-900/40 text-blue-300 border-blue-800',
    mixed_signal:      'bg-yellow-900/40 text-yellow-300 border-yellow-800',
    skipped_over:      'bg-orange-900/40 text-orange-300 border-orange-800',
    declining:         'bg-red-900/40 text-red-300 border-red-800',
  }
  const classifColor = classificationColors[takeaway.classification] || 'bg-gray-700 text-gray-300 border-gray-600'

  const AreaList = ({ title, items, tone }) => {
    if (!Array.isArray(items) || items.length === 0) return null
    const toneColor = {
      hot:  'text-emerald-300',
      cold: 'text-red-300',
      gent: 'text-blue-300',
      skip: 'text-orange-300',
      decl: 'text-red-400',
    }[tone] || 'text-gray-300'
    return (
      <div>
        <div className={`text-xs uppercase tracking-wide mb-1 ${toneColor}`}>{title}</div>
        <div className="flex flex-wrap gap-1.5">
          {items.slice(0, 8).map((it, i) => (
            <span key={i} className="text-xs bg-cw-dark border border-cw-border rounded px-2 py-0.5"
                  title={it.note || ''}>
              {it.label || it.id}
            </span>
          ))}
          {items.length > 8 && <span className="text-xs text-gray-500">+{items.length - 8} more</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-cw-card border border-cw-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-400">Demographics & Socioeconomic Context</h3>
        {takeaway.classification && (
          <span className={`text-xs px-2 py-0.5 rounded border ${classifColor} ml-auto`}>
            {takeaway.classification.replace(/_/g, ' ')}
            {takeaway.confidence && ` · ${takeaway.confidence} conf`}
          </span>
        )}
      </div>

      {/* Narrative */}
      {d.narrative && (
        <div className="bg-cw-dark rounded-lg p-4 mb-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Narrative</div>
          <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{fixMojibake(d.narrative)}</p>
        </div>
      )}

      {/* Takeaway */}
      {(takeaway.rent_implication || takeaway.strategy_implication || (takeaway.key_signals || []).length) && (
        <div className="bg-cw-dark rounded-lg p-4 mb-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Takeaway for this site</div>
          {Array.isArray(takeaway.key_signals) && takeaway.key_signals.length > 0 && (
            <ul className="text-sm text-gray-200 list-disc ml-5 mb-2 space-y-0.5">
              {takeaway.key_signals.map((s, i) => <li key={i}>{fixMojibake(s)}</li>)}
            </ul>
          )}
          {takeaway.rent_implication && (
            <div className="text-sm text-gray-200"><span className="text-xs uppercase text-gray-500 mr-2">Rent</span>{takeaway.rent_implication}</div>
          )}
          {takeaway.strategy_implication && (
            <div className="text-sm text-gray-200 mt-1"><span className="text-xs uppercase text-gray-500 mr-2">Strategy</span>{takeaway.strategy_implication}</div>
          )}
        </div>
      )}

      {/* Comparison table */}
      <div className="bg-cw-dark rounded-lg p-4 mb-4 overflow-x-auto">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">MSA · Submarket · Site Tract</div>
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-cw-border">
              <th className="text-left pb-2 pr-2">Metric</th>
              <th className="text-left pb-2 px-2">{areas.msa?.label || areas.msa?.name || 'MSA'}</th>
              <th className="text-left pb-2 px-2">{areas.submarket?.label || areas.submarket?.name || 'Submarket'}</th>
              <th className="text-left pb-2 px-2">{areas.tract_local?.combined_label || areas.tract_local?.name || 'Site tract'}</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map(([key, label, kind]) => {
              const msa  = getMetric(areas.msa, key)
              const sub  = getMetric(areas.submarket, key)
              const trac = getMetric(areas.tract_local, key)
              return (
                <tr key={key} className="border-b border-cw-border/50">
                  <td className="py-2 pr-2 text-gray-400">{label}</td>
                  {[msa, sub, trac].map((m, i) => (
                    <td key={i} className="py-2 px-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{fmt(kind, m.curVal)}</span>
                        {m.ann != null ? (
                          <span className={`text-xs ${m.ann > 0 ? 'text-green-400' : m.ann < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                            {formatAnnualized(m.ann, m.kind)}
                          </span>
                        ) : m.legacyPct != null ? (
                          <span className={`text-xs ${m.legacyPct > 0 ? 'text-green-400' : m.legacyPct < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                            {m.legacyPct > 0 ? '+' : ''}{m.legacyPct.toFixed(1)}% total
                          </span>
                        ) : null}
                        <TrendArrow label={m.label} />
                        <PctPill p={m.levelPct} />
                      </div>
                      {m.priVal != null && (
                        <div className="text-[10px] text-gray-500">was {fmt(kind, m.priVal)}</div>
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="text-[10px] text-gray-500 mt-2">
          Changes shown as CAGR (%/yr) for levels or annualized pp/yr for rates.
          {' '}▲▲ booming · ▲ up · ● steady · ▼ down · ▼▼ busting.
          {' '}Pill = level percentile within peer set (80pctl+ = top 20%).
        </div>
      </div>

      {/* Hot / Cold Map */}
      {(hotCold.hot_by_level?.length || hotCold.hot_by_trend?.length || hotCold.cold_by_level?.length ||
        hotCold.gentrifying?.length || hotCold.skipped_over?.length || hotCold.declining?.length) ? (
        <div className="bg-cw-dark rounded-lg p-4 mb-4">
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Hot / Cold Map — Nearby Areas</div>
            {hotCold.peer_count != null && (
              <div className="text-[10px] text-gray-500">{hotCold.peer_count} peers · {hotCold.peer_set}</div>
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <AreaList title="Hot by level (already strong)"  items={hotCold.hot_by_level}  tone="hot" />
            <AreaList title="Hot by trend (fast growth)"      items={hotCold.hot_by_trend}  tone="hot" />
            <AreaList title="Cold by level (currently weak)"  items={hotCold.cold_by_level} tone="cold" />
            <AreaList title="Cold by trend (declining)"       items={hotCold.cold_by_trend} tone="cold" />
            <AreaList title="Gentrifying (cold→hot trend)"    items={hotCold.gentrifying}   tone="gent" />
            <AreaList title="Spillover candidates (near us)"  items={hotCold.spillover_candidates} tone="hot" />
            <AreaList title="Skipped-over (flat while neighbors boom)" items={hotCold.skipped_over} tone="skip" />
            <AreaList title="Declining (was strong, now fading)" items={hotCold.declining}  tone="decl" />
          </div>
        </div>
      ) : null}

      {/* Special notes */}
      {special.length > 0 && (
        <div className="bg-cw-dark rounded-lg p-4 mb-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Special Notes</div>
          <ul className="space-y-2">
            {special.map((n, i) => (
              <li key={i} className="text-sm">
                <div className="font-semibold text-gray-200">
                  {n.label}
                  {n.confidence && <span className="text-[10px] text-gray-500 ml-2">({n.confidence})</span>}
                </div>
                {n.metric_evidence && <div className="text-xs text-gray-400">{n.metric_evidence}</div>}
                {n.implication_for_deal && <div className="text-xs text-gray-300 italic mt-0.5">{n.implication_for_deal}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Submarket definition footer */}
      {sub.method && (
        <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t border-cw-border">
          <div><span className="uppercase tracking-wide mr-1">Submarket:</span> {sub.method}</div>
          {sub.method_rationale && <div className="italic">{sub.method_rationale}</div>}
          {Array.isArray(sub.zip_codes_included) && sub.zip_codes_included.length > 0 && (
            <div>ZIPs: {sub.zip_codes_included.join(', ')}</div>
          )}
          {sub.population_covered != null && <div>Pop: {Number(sub.population_covered).toLocaleString()}</div>}
        </div>
      )}
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

// ────────────────────────────────────────────────────────────────
// RentCompsCard — renders market_data.rent_comps as a comparable table.
// Handles both the old shape (rents: {1br, 2br, 3br}) and flat shape.
// Shows: name · year/class · units · distance · 1BR/2BR/3BR rents · source.
// Returns null for deals with no rent comp data.
// ────────────────────────────────────────────────────────────────
function RentCompsCard({ data }) {
  const market = (() => {
    if (data == null) return null
    if (typeof data !== 'string') return data
    try { return JSON.parse(data) } catch { return null }
  })()
  const comps = market?.rent_comps || market?.comps
  if (!Array.isArray(comps) || comps.length === 0) return null

  const fmtMoney = (v) => (v || v === 0) ? `$${Math.round(v).toLocaleString()}` : '—'
  const rentCell = (r, key) => {
    if (!r) return '—'
    const direct = r[key]
    if (typeof direct === 'number') return fmtMoney(direct)
    if (direct && typeof direct === 'object' && direct.rent != null) return fmtMoney(direct.rent)
    return '—'
  }

  return (
    <div className="bg-cw-card border border-cw-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <LineChart className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-400">Rent Comps</h3>
        <span className="ml-auto text-xs text-gray-500">{comps.length} comp{comps.length === 1 ? '' : 's'}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-cw-border">
              <th className="py-1.5 pr-3">Property</th>
              <th className="py-1.5 pr-3">Year</th>
              <th className="py-1.5 pr-3 text-right">Units</th>
              <th className="py-1.5 pr-3">Product</th>
              <th className="py-1.5 pr-3 text-right">Dist</th>
              <th className="py-1.5 pr-3 text-right">1BR</th>
              <th className="py-1.5 pr-3 text-right">2BR</th>
              <th className="py-1.5 pr-3 text-right">3BR</th>
              <th className="py-1.5 pr-3 text-right">Avg</th>
              <th className="py-1.5 pr-3">Source</th>
            </tr>
          </thead>
          <tbody>
            {comps.map((c, i) => {
              const r = c.rents || {}
              const dist = c.distance_miles ?? c.proximity_miles ?? c.miles
              return (
                <tr key={i} className="border-b border-cw-border/40">
                  <td className="py-1.5 pr-3 text-gray-200">
                    {c.name || c.property || '—'}
                    {c.class && <span className="ml-1 text-[10px] text-gray-500">Cl {c.class}</span>}
                    {c.note && <div className="text-[11px] text-gray-500 mt-0.5">{c.note}</div>}
                  </td>
                  <td className="py-1.5 pr-3 text-gray-400">{c.year_built || '—'}</td>
                  <td className="py-1.5 pr-3 text-right text-gray-400">{c.units || c.total_units || '—'}</td>
                  <td className="py-1.5 pr-3 text-gray-400 text-xs">{c.product || c.product_type || '—'}</td>
                  <td className="py-1.5 pr-3 text-right text-gray-400">{dist != null ? `${dist} mi` : '—'}</td>
                  <td className="py-1.5 pr-3 text-right">{rentCell(r, '1br')}</td>
                  <td className="py-1.5 pr-3 text-right">{rentCell(r, '2br')}</td>
                  <td className="py-1.5 pr-3 text-right">{rentCell(r, '3br')}</td>
                  <td className="py-1.5 pr-3 text-right text-gray-400">{r.avg ? fmtMoney(r.avg) : '—'}</td>
                  <td className="py-1.5 pr-3 text-[11px] text-gray-500">{c.source || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// MarketContextCard — submarket vacancy, cap rate, pipeline, and sales
// comps. Reads from market_data. Returns null for deals that haven't run
// step_3 or that have no submarket metrics.
// ────────────────────────────────────────────────────────────────
function MarketContextCard({ data }) {
  const market = (() => {
    if (data == null) return null
    if (typeof data !== 'string') return data
    try { return JSON.parse(data) } catch { return null }
  })()
  if (!market) return null
  const vac   = market.submarket_vacancy_pct ?? market.submarket_vacancy
  const cap   = market.submarket_cap_rate ?? market.market_cap_rate
  const uc    = market.units_under_construction
  const sales = market.sales_comps || market.sale_comps
  const hasAny = vac != null || cap != null || uc != null || (Array.isArray(sales) && sales.length > 0)
  if (!hasAny) return null

  const fmtPct = (v) => v != null ? `${(v < 1 ? v * 100 : v).toFixed(1)}%` : '—'
  const fmtMoneyM = (v) => (v || v === 0) ? `$${(v / 1e6).toFixed(1)}M` : '—'

  return (
    <div className="bg-cw-card border border-cw-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-400">Market Context</h3>
        {market.submarket && <span className="ml-auto text-xs text-gray-500">{market.submarket}</span>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Submarket Vacancy" value={fmtPct(vac)} warn={vac != null && vac >= 7} />
        <MetricCard label="Market Cap Rate" value={fmtPct(cap)} />
        <MetricCard label="Units Under Construction" value={uc != null ? uc.toLocaleString() : '—'} />
        <MetricCard label="MSA Pop (K)" value={market.msa_population ? `${(market.msa_population / 1000).toFixed(0)}K` : '—'} sub={market.msa_pop_growth_pct ? `+${market.msa_pop_growth_pct.toFixed(2)}%/yr` : null} />
      </div>

      {market.submarket_vacancy_note && (
        <div className="text-[11px] text-gray-500 italic">{market.submarket_vacancy_note}</div>
      )}
      {market.pipeline_note && (
        <div className="text-[11px] text-gray-500 italic">{market.pipeline_note}</div>
      )}

      {Array.isArray(sales) && sales.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2 mt-2">Sales Comps</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-cw-border">
                <th className="py-1.5 pr-3">Property</th>
                <th className="py-1.5 pr-3">Year</th>
                <th className="py-1.5 pr-3 text-right">Units</th>
                <th className="py-1.5 pr-3">Sale Date</th>
                <th className="py-1.5 pr-3 text-right">Price</th>
                <th className="py-1.5 pr-3 text-right">$/Unit</th>
                <th className="py-1.5 pr-3 text-right">Implied Cap</th>
                <th className="py-1.5 pr-3">Source</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s, i) => (
                <tr key={i} className="border-b border-cw-border/40">
                  <td className="py-1.5 pr-3 text-gray-200">{s.name || s.property || '—'}</td>
                  <td className="py-1.5 pr-3 text-gray-400">{s.year_built || '—'}</td>
                  <td className="py-1.5 pr-3 text-right text-gray-400">{s.units || '—'}</td>
                  <td className="py-1.5 pr-3 text-gray-400">{s.sale_date || '—'}</td>
                  <td className="py-1.5 pr-3 text-right text-gray-300">{fmtMoneyM(s.sale_price)}</td>
                  <td className="py-1.5 pr-3 text-right text-gray-400">{s.price_per_unit ? `$${Math.round(s.price_per_unit).toLocaleString()}` : '—'}</td>
                  <td className="py-1.5 pr-3 text-right text-gray-400">{s.implied_cap_rate != null ? fmtPct(s.implied_cap_rate) : '—'}</td>
                  <td className="py-1.5 pr-3 text-[11px] text-gray-500">{s.source || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {Array.isArray(market.data_sources) && market.data_sources.length > 0 && (
        <div className="text-[11px] text-gray-600 pt-2 border-t border-cw-border/40">
          Sources: {market.data_sources.join(' · ')}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// TaxCompsCard — renders property tax analysis from noi_data:
//   (1) effective rate summary (method, jurisdiction, ratio, millage, $/unit)
//   (2) comp table (appraised, assessed, per-unit, jurisdiction, sale) when
//       noi_data.tax_comps is a structured array; falls back to string list.
// Returns null when no tax data is present.
// ────────────────────────────────────────────────────────────────
function TaxCompsCard({ data }) {
  const noi = (() => {
    if (data == null) return null
    if (typeof data !== 'string') return data
    try { return JSON.parse(data) } catch { return null }
  })()
  const oe = noi?.operating_expenses || {}
  const loc = noi?.locality || oe.locality || {}
  const method = oe.property_tax_method || noi?.property_tax_method
  const perUnit = oe.property_tax_per_unit
  const total = oe.property_tax_total ?? oe.taxes_total
  const compsRaw = noi?.tax_comps || oe.tax_comps || oe.property_tax_comps
  const comps = Array.isArray(compsRaw) ? compsRaw : null
  const stringList = (Array.isArray(compsRaw) && compsRaw.every(c => typeof c === 'string')) ? compsRaw : null

  if (!method && !perUnit && !total && !comps && !loc.jurisdiction) return null

  const fmtMoney = (v) => (v || v === 0) ? `$${Math.round(v).toLocaleString()}` : '—'
  const fmtMoneyM = (v) => (v || v === 0) ? `$${(v / 1e6).toFixed(2)}M` : '—'
  const fmtPct = (v) => v != null ? `${(v < 1 ? v * 100 : v).toFixed(2)}%` : '—'

  return (
    <div className="bg-cw-card border border-cw-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Landmark className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-400">Property Tax Analysis</h3>
        {(loc.jurisdiction || noi?.tax_comp_source) && (
          <span className="ml-auto text-xs text-gray-500">
            {loc.jurisdiction || noi?.tax_comp_source}
          </span>
        )}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Property Tax (annual)" value={fmtMoney(total)} />
        <MetricCard label="Per Unit" value={fmtMoney(perUnit)} />
        {loc.millage_rate != null && (
          <MetricCard label="Millage" value={`${Number(loc.millage_rate).toFixed(1)} mills`} />
        )}
        {loc.assessment_ratio != null && (
          <MetricCard label="Assessment Ratio" value={fmtPct(loc.assessment_ratio)} />
        )}
        {loc.effective_tax_rate_pct != null && (
          <MetricCard label="Effective Rate" value={fmtPct(loc.effective_tax_rate_pct / 100)} sub="on market value" />
        )}
      </div>

      {method && (
        <div className="text-[11px] text-gray-500 italic">
          <span className="uppercase tracking-wide text-gray-600 mr-1">Method:</span>{method}
        </div>
      )}

      {comps && !stringList && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Tax Comps Used</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-cw-border">
                  <th className="py-1.5 pr-3">Property</th>
                  <th className="py-1.5 pr-3">Year</th>
                  <th className="py-1.5 pr-3 text-right">Units</th>
                  <th className="py-1.5 pr-3 text-right">Appraised</th>
                  <th className="py-1.5 pr-3 text-right">$/Unit</th>
                  <th className="py-1.5 pr-3">Jurisdiction</th>
                  <th className="py-1.5 pr-3 text-right">Sale Price</th>
                  <th className="py-1.5 pr-3">Parcel(s)</th>
                </tr>
              </thead>
              <tbody>
                {comps.map((c, i) => (
                  <tr key={i} className="border-b border-cw-border/40">
                    <td className="py-1.5 pr-3 text-gray-200">
                      {c.property || c.name || '—'}
                      {c.owner && <div className="text-[10px] text-gray-600">{c.owner}</div>}
                    </td>
                    <td className="py-1.5 pr-3 text-gray-400">{c.year_built || c.year || '—'}</td>
                    <td className="py-1.5 pr-3 text-right text-gray-400">{c.units || '—'}</td>
                    <td className="py-1.5 pr-3 text-right text-gray-300">{fmtMoneyM(c.appraised ?? c.appraised_value ?? c.assessed_value)}</td>
                    <td className="py-1.5 pr-3 text-right text-gray-400">{c.per_unit ? fmtMoney(c.per_unit) : '—'}</td>
                    <td className="py-1.5 pr-3 text-gray-400 text-xs">{c.jurisdiction || '—'}</td>
                    <td className="py-1.5 pr-3 text-right text-gray-400">{c.sale_2026 || c.sale_price ? fmtMoneyM(c.sale_2026 || c.sale_price) : '—'}</td>
                    <td className="py-1.5 pr-3 text-[10px] text-gray-600 font-mono">{c.parcel_id || c.parcels || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stringList && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Tax Comps Used</div>
          <ul className="text-sm text-gray-300 space-y-1">
            {stringList.map((c, i) => <li key={i}>• {c}</li>)}
          </ul>
        </div>
      )}

      {/* Closing taxes (state-level) — only when locality.deed_tax_rate_pct etc. populated */}
      {(loc.deed_tax_rate_pct != null || loc.mortgage_tax_rate_pct != null) && (
        <div className="pt-3 border-t border-cw-border/40">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Closing Tax Rates</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {loc.deed_tax_rate_pct != null && (
              <div>
                <div className="text-gray-500 text-xs">Deed / Grantor's Tax (seller)</div>
                <div className="text-gray-200 font-medium">{fmtPct(loc.deed_tax_rate_pct / 100)} of sale price</div>
                {loc.deed_tax_citation && <div className="text-[11px] text-gray-600">{loc.deed_tax_citation}</div>}
              </div>
            )}
            {loc.mortgage_tax_rate_pct != null && (
              <div>
                <div className="text-gray-500 text-xs">Mortgage Recording Tax (borrower)</div>
                <div className="text-gray-200 font-medium">{fmtPct(loc.mortgage_tax_rate_pct / 100)} of loan amount</div>
                {loc.mortgage_tax_citation && <div className="text-[11px] text-gray-600">{loc.mortgage_tax_citation}</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// LocalityFeesCard — renders one-time / development fees for the
// jurisdiction: water tap, sewer connection, impact fees, proffers,
// building permit, plan review, land disturbance, traffic. Reads from
// dev_cost_data.locality_fees (preferred) or dev_cost_data.permits_impact_fees
// detail. Returns null if no fee data is structured.
// ────────────────────────────────────────────────────────────────
function LocalityFeesCard({ data, units }) {
  const dev = (() => {
    if (data == null) return null
    if (typeof data !== 'string') return data
    try { return JSON.parse(data) } catch { return null }
  })()
  const fees = dev?.locality_fees || dev?.fees
  if (!fees || typeof fees !== 'object') return null
  const items = fees.items || (Array.isArray(fees) ? fees : null)
  if (!Array.isArray(items) || items.length === 0) return null

  const fmtMoney = (v) => (v || v === 0) ? `$${Math.round(v).toLocaleString()}` : '—'
  const total = items.reduce((s, it) => s + (Number(it.total) || 0), 0)
  const perUnit = (units && total) ? total / units : null

  return (
    <div className="bg-cw-card border border-cw-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Landmark className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-400">Locality Fees (One-Time Development Costs)</h3>
        {fees.jurisdiction && <span className="ml-auto text-xs text-gray-500">{fees.jurisdiction}</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-cw-border">
              <th className="py-1.5 pr-3">Fee</th>
              <th className="py-1.5 pr-3">Provider</th>
              <th className="py-1.5 pr-3">Basis</th>
              <th className="py-1.5 pr-3 text-right">Total</th>
              <th className="py-1.5 pr-3 text-right">$/Unit</th>
              <th className="py-1.5 pr-3">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-b border-cw-border/40">
                <td className="py-1.5 pr-3 text-gray-200">
                  {it.label || it.name}
                  {it.note && <div className="text-[11px] text-gray-500 mt-0.5">{it.note}</div>}
                </td>
                <td className="py-1.5 pr-3 text-gray-400 text-xs">{it.provider || '—'}</td>
                <td className="py-1.5 pr-3 text-gray-400 text-xs">{it.basis || '—'}</td>
                <td className="py-1.5 pr-3 text-right text-gray-300">{fmtMoney(it.total)}</td>
                <td className="py-1.5 pr-3 text-right text-gray-400">{(it.total != null && units) ? fmtMoney(it.total / units) : '—'}</td>
                <td className="py-1.5 pr-3 text-[11px]">
                  {it.confidence === 'good' && <span className="text-green-400">good</span>}
                  {it.confidence === 'estimate' && <span className="text-yellow-400">estimate</span>}
                  {it.confidence === 'TODO' && <span className="text-orange-400">TODO</span>}
                  {!it.confidence && <span className="text-gray-500">—</span>}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-cw-border font-semibold">
              <td className="py-2 pr-3 text-gray-100" colSpan={3}>Total</td>
              <td className="py-2 pr-3 text-right text-emerald-300">{fmtMoney(total)}</td>
              <td className="py-2 pr-3 text-right text-gray-300">{perUnit ? fmtMoney(perUnit) : '—'}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {Array.isArray(fees.source_urls) && fees.source_urls.length > 0 && (
        <div className="text-[11px] text-gray-600 pt-2 border-t border-cw-border/40">
          Sources: {fees.source_urls.map((u, i) => (
            <a key={i} href={u} target="_blank" rel="noreferrer" className="text-cw-accent hover:underline ml-1">[{i + 1}]</a>
          ))}
        </div>
      )}
      {fees.last_verified && (
        <div className="text-[10px] text-gray-600">Last verified: {fees.last_verified}</div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// SensitivityCard — renders stress-test results from the primary
// scenario in scenarios_data. Each sensitivity is one row showing the
// stressed assumption, resulting YoC, bps vs hurdle, and verdict.
// Returns null if the primary scenario has no sensitivities.
// ────────────────────────────────────────────────────────────────
function SensitivityCard({ scenarios }) {
  const arr = (() => {
    if (scenarios == null) return null
    if (typeof scenarios !== 'string') return scenarios
    try { return JSON.parse(scenarios) } catch { return null }
  })()
  if (!Array.isArray(arr) || arr.length === 0) return null

  // Find the primary (non-archived) scenario
  const primary = arr.find(s => s.primary && !s.archived) || arr.find(s => !s.archived)
  if (!primary) return null

  const sens = primary.sensitivities || primary.step_8_returns?.sensitivities
  if (!sens || typeof sens !== 'object') return null

  // Normalize: sens may be an object keyed by name, or an array
  const rows = Array.isArray(sens) ? sens : Object.entries(sens).map(([key, v]) => ({ key, ...v }))
  if (!rows.length) return null

  const baseYoc = primary.yoc ?? primary.step_8_returns?.yield_on_cost
  const hurdle = 0.065
  const fmtPct = (v) => v != null ? `${(v < 1 ? v * 100 : v).toFixed(2)}%` : '—'
  const labelOf = (k) => {
    const map = {
      insurance_500: 'Insurance @ $500/unit (vs benchmark)',
      insurance_500_per_unit: 'Insurance @ $500/unit (vs benchmark)',
      hc_plus_5pct: 'Hard costs +5%',
      hard_costs_plus_5pct: 'Hard costs +5%',
      vacancy_8pct: 'Vacancy 8% (vs 6% floor)',
      rent_plus_50_per_unit: 'Rent +$50/unit/mo',
    }
    return map[k] || (k || '').replace(/_/g, ' ')
  }

  return (
    <div className="bg-cw-card border border-cw-border rounded-xl p-4 mt-3">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-400">Sensitivity Analysis (Primary Scenario)</h3>
        {baseYoc != null && (
          <span className="ml-auto text-xs text-gray-500">Base YoC: {fmtPct(baseYoc)} · Hurdle: {fmtPct(hurdle)}</span>
        )}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-cw-border">
            <th className="py-1.5 pr-3">Stress Test</th>
            <th className="py-1.5 pr-3 text-right">Stressed YoC</th>
            <th className="py-1.5 pr-3 text-right">Δ vs Base</th>
            <th className="py-1.5 pr-3 text-right">vs Hurdle</th>
            <th className="py-1.5 pr-3 text-center">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const yoc = r.yoc
            const delta = (baseYoc != null && yoc != null) ? (yoc - baseYoc) : null
            const vsHurdle = (yoc != null) ? (yoc - hurdle) : null
            const passing = vsHurdle != null && vsHurdle >= 0
            return (
              <tr key={i} className="border-b border-cw-border/40">
                <td className="py-1.5 pr-3 text-gray-200">{labelOf(r.key) || labelOf(r.assumption)}</td>
                <td className="py-1.5 pr-3 text-right text-gray-300">{fmtPct(yoc)}</td>
                <td className="py-1.5 pr-3 text-right text-gray-500">{delta != null ? `${delta >= 0 ? '+' : ''}${(delta * 10000).toFixed(0)} bps` : '—'}</td>
                <td className={`py-1.5 pr-3 text-right ${passing ? 'text-emerald-400' : 'text-red-400'}`}>
                  {vsHurdle != null ? `${vsHurdle >= 0 ? '+' : ''}${(vsHurdle * 10000).toFixed(0)} bps` : '—'}
                </td>
                <td className="py-1.5 pr-3 text-center">
                  {r.verdict === 'PASS' || passing
                    ? <span className="text-[10px] uppercase tracking-wide bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">PASS</span>
                    : <span className="text-[10px] uppercase tracking-wide bg-red-500/20 text-red-300 px-2 py-0.5 rounded">FAIL</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// CorrectionNoticesBanner — yellow info bar at the top of the page when
// recent material corrections have been applied. Reads from any of:
//   deal.corrections (top-level array), or
//   noi_data.corrections / market_data.corrections (per-section arrays).
// Each correction: { date, kind, summary, before?, after? }
// ────────────────────────────────────────────────────────────────
function CorrectionNoticesBanner({ deal }) {
  const collect = []
  const tryArr = (v) => {
    if (Array.isArray(v)) v.forEach(c => collect.push(c))
  }
  tryArr(deal.corrections)
  for (const fld of ['noi_data', 'market_data', 'returns_data', 'dev_cost_data', 'scenarios_data']) {
    let parsed = deal[fld]
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed) } catch { parsed = null }
    }
    if (parsed && typeof parsed === 'object') tryArr(parsed.corrections)
  }
  if (collect.length === 0) return null

  // Sort newest first
  collect.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  return (
    <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-400" />
        <h3 className="text-sm font-semibold text-yellow-200">Correction Notices</h3>
        <span className="ml-auto text-xs text-yellow-400">{collect.length} correction{collect.length === 1 ? '' : 's'} applied</span>
      </div>
      <ul className="space-y-1.5">
        {collect.map((c, i) => (
          <li key={i} className="text-sm text-yellow-100 flex gap-3">
            <span className="text-yellow-400 font-mono text-xs shrink-0 w-24">{c.date || ''}</span>
            <span className="text-yellow-300 font-medium uppercase text-[10px] tracking-wide shrink-0 w-20">{c.kind || ''}</span>
            <span className="text-yellow-100 flex-1">{c.summary}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// QuestionsForJack — pipeline command-center panel rendering questions
// captured by skills' _contract.questions_for_jack output. Renders at top
// of the deal page (after CorrectionNoticesBanner). Color-coded:
//   - Blocking questions → red
//   - Open (non-blocking) → yellow
//   - Answered → collapsed gray
// Click a question to expand its context. Returns null if no questions.
// ────────────────────────────────────────────────────────────────
function QuestionsForJack({ questions }) {
  const [expanded, setExpanded] = useState({})
  if (!questions || questions.length === 0) return null

  const blockers = questions.filter(q => q.blocks_downstream && !q.answered)
  const open = questions.filter(q => !q.blocks_downstream && !q.answered)
  const answered = questions.filter(q => q.answered)

  const toggle = (i) => setExpanded(e => ({ ...e, [i]: !e[i] }))

  const QuestionRow = ({ q, i, blocker }) => (
    <div
      className={`rounded-lg border p-3 cursor-pointer transition-colors ${
        blocker
          ? 'border-red-800 bg-red-900/20 hover:bg-red-900/30'
          : q.answered
          ? 'border-gray-800 bg-cw-dark opacity-60'
          : 'border-yellow-800 bg-yellow-900/10 hover:bg-yellow-900/20'
      }`}
      onClick={() => toggle(i)}
    >
      <div className="flex items-start gap-2">
        {blocker
          ? <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          : q.answered
          ? <CheckCircle className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
          : <HelpCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${blocker ? 'bg-red-900/50 text-red-300' : 'bg-gray-800 text-gray-400'}`}>
              {q.step}
            </span>
            {blocker && <span className="text-xs text-red-400 font-semibold">BLOCKS DOWNSTREAM</span>}
          </div>
          <p className={`text-sm mt-1 font-medium ${blocker ? 'text-red-200' : q.answered ? 'text-gray-500' : 'text-white'}`}>
            {q.question}
          </p>
          {expanded[i] && q.context && (
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{q.context}</p>
          )}
        </div>
        <span className="text-gray-600 text-xs shrink-0">{expanded[i] ? 'â–²' : 'â–¼'}</span>
      </div>
    </div>
  )

  return (
    <div className="bg-cw-card border border-cw-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <HelpCircle className="w-4 h-4 text-yellow-400" />
        <h3 className="text-sm font-semibold text-gray-400">Questions for You</h3>
        <div className="flex gap-1.5 ml-auto">
          {blockers.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/50 text-red-300 font-medium">
              {blockers.length} blocking
            </span>
          )}
          {open.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-300 font-medium">
              {open.length} open
            </span>
          )}
          {answered.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">
              {answered.length} answered
            </span>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {blockers.map((q, i) => <QuestionRow key={`b${i}`} q={q} i={`b${i}`} blocker />)}
        {open.map((q, i) => <QuestionRow key={`o${i}`} q={q} i={`o${i}`} blocker={false} />)}
        {answered.map((q, i) => <QuestionRow key={`a${i}`} q={q} i={`a${i}`} blocker={false} />)}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Helpers: safe JSON parse, citation rendering, sources list
// ────────────────────────────────────────────────────────────────

function parseMaybeJSON(v) {
  if (v == null) return null
  if (typeof v !== 'string') return v
  try { return JSON.parse(v) } catch { return null }
}

// Render text containing [^sourceid] markers as inline numbered chips that
// hyperlink to the matching source in `sources`. Unknown ids render as the
// raw marker so they're visible as a bug.
function CitedText({ text, sources }) {
  if (!text) return null
  const srcArr = Array.isArray(sources) ? sources : (parseMaybeJSON(sources) || [])
  const idToIdx = {}
  srcArr.forEach((s, i) => { if (s && s.id) idToIdx[s.id] = i + 1 })

  const renderBlock = (block, key) => {
    const parts = []
    const re = /\[\^([a-zA-Z0-9_\-.]+)\]/g
    let last = 0
    let m
    let j = 0
    while ((m = re.exec(block)) !== null) {
      if (m.index > last) parts.push(block.slice(last, m.index))
      const id = m[1]
      const num = idToIdx[id]
      const src = srcArr.find(s => s && s.id === id)
      if (num && src) {
        parts.push(
          <a
            key={`c${key}-${j++}`}
            href={src.url || '#'}
            target={src.url ? '_blank' : undefined}
            rel="noopener noreferrer"
            title={src.label ? `${src.label}${src.note ? ' — ' + src.note : ''}` : id}
            className="inline-flex items-center justify-center align-super text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 hover:text-emerald-200 rounded px-1 ml-0.5 no-underline"
          >
            {num}
          </a>
        )
      } else {
        parts.push(<span key={`c${key}-${j++}`} className="text-red-400">[^{id}]</span>)
      }
      last = re.lastIndex
    }
    if (last < block.length) parts.push(block.slice(last))
    return parts
  }

  const blocks = String(text).split(/\n{2,}/)
  return (
    <>
      {blocks.map((b, i) => (
        <p key={i} className="whitespace-pre-wrap">{renderBlock(b, i)}</p>
      ))}
    </>
  )
}

function SourcesList({ sources }) {
  const arr = Array.isArray(sources) ? sources : (parseMaybeJSON(sources) || [])
  if (!arr.length) return null
  return (
    <Section title="Primary Sources" icon={FileText}>
      <ol className="space-y-2 text-sm">
        {arr.map((s, i) => (
          <li key={s.id || i} className="flex gap-3">
            <span className="inline-flex items-center justify-center shrink-0 w-6 h-6 text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 rounded">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-gray-200">
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-300 underline decoration-gray-700 hover:decoration-emerald-500">
                    {s.label || s.url}
                  </a>
                ) : (
                  <span>{s.label || s.id}</span>
                )}
              </div>
              {s.note && <div className="text-xs text-gray-500 mt-0.5">{s.note}</div>}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  )
}

// ────────────────────────────────────────────────────────────────
// Scenario Detail Drawer — click a scenario row to see inputs
// ────────────────────────────────────────────────────────────────

function MetricBox({ label, value, sub }) {
  return (
    <div className="bg-cw-dark rounded-lg p-3">
      <div className="text-[11px] text-gray-500 mb-1 uppercase tracking-wide">{label}</div>
      <div className="text-base font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  )
}

function KVTable({ rows }) {
  const cleaned = rows.filter(r => r[1] !== null && r[1] !== undefined && r[1] !== '')
  if (!cleaned.length) return <div className="text-xs text-gray-500 italic">No data.</div>
  return (
    <div className="divide-y divide-cw-border">
      {cleaned.map(([k, v], i) => (
        <div key={i} className="flex justify-between py-1.5 text-sm">
          <span className="text-gray-400">{k}</span>
          <span className="text-gray-200 text-right">{v}</span>
        </div>
      ))}
    </div>
  )
}

// Stabilized value = underwritten NOI / 5.15% cap rate. Shown at the end of
// both NOI Underwriting and Development Budget sections in the scenario modal.
// Also reports value/unit and spread vs. TDC when both are present.
const STABILIZED_CAP_RATE = 0.0515

function StabilizedValueBox({ noi, tdc, units }) {
  if (!noi || !isFinite(noi) || noi <= 0) return null
  const value = noi / STABILIZED_CAP_RATE
  const fmtM = (v) => `$${(v / 1e6).toFixed(2)}M`
  const fmtK = (v) => `$${Math.round(v / 1000).toLocaleString()}K`
  const valuePerUnit = units ? value / units : null
  const spreadVsTdc = (tdc && isFinite(tdc) && tdc > 0) ? value - tdc : null
  const spreadPct = (tdc && spreadVsTdc != null) ? spreadVsTdc / tdc : null
  return (
    <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-emerald-300/80">
            Stabilized Value @ {(STABILIZED_CAP_RATE * 100).toFixed(2)}% cap
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            NOI ÷ {(STABILIZED_CAP_RATE * 100).toFixed(2)}%
            {valuePerUnit ? <span> · {fmtK(valuePerUnit)}/unit</span> : null}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-semibold text-emerald-200">{fmtM(value)}</div>
          {spreadVsTdc != null ? (
            <div className={`text-xs mt-0.5 ${spreadVsTdc >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {spreadVsTdc >= 0 ? '+' : ''}{fmtM(spreadVsTdc)} vs TDC
              {spreadPct != null ? ` (${(spreadPct * 100).toFixed(1)}%)` : ''}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ScenarioDetailDrawer({ scenario, sources, onClose }) {
  if (!scenario) return null
  const s4 = scenario.step_4_unit_mix || {}
  const s5 = scenario.step_5_noi || {}
  const s6 = scenario.step_6_dev_costs || {}
  const s7 = scenario.step_7_financing || {}
  const s8 = scenario.step_8_returns || {}
  const s9 = scenario.step_9_strategy || {}

  // Defense-in-depth: any percent stored as whole number (e.g. ltv: 70.0
  // meaning 70%, not 7000%) must be divided by 100 before rendering.
  const normPct = (v) => {
    if (v == null) return null
    const n = Number(v)
    if (!Number.isFinite(n)) return null
    return n > 1 ? n / 100 : n
  }

  const fmtPct = (v) => {
    const n = normPct(v)
    return (n != null) ? `${(n * 100).toFixed(2)}%` : '—'
  }
  const fmtMoneyM = (v) => (v || v === 0) ? `$${(v / 1e6).toFixed(2)}M` : '—'
  const fmtMoney = (v) => (v || v === 0) ? `$${Math.round(v).toLocaleString()}` : '—'
  const fmtX = (v) => (v || v === 0) ? `${Number(v).toFixed(2)}x` : '—'

  const units = s4.total_units
  const tdc = s6.total_dev_cost?.tdc_total ?? s6.tdc_total ?? s6.tdc
  const yoc = s8.yield_on_cost ?? s8.yoc ?? s6.feasibility_analysis?.implied_yoc_at_tdc
  const dscr = s8.dscr_amortizing ?? s8.dscr
  const irr = s8.levered_irr ?? s8.irr_levered
  const em = s8.equity_multiple
  const devSpread = s8.development_spread_bps

  const unitMixRows = Array.isArray(s4.unit_mix) ? s4.unit_mix
    : Array.isArray(s4.units_by_type) ? s4.units_by_type
    : Array.isArray(s4.mix) ? s4.mix : []

  // Totals across unit-mix rows (count-weighted where appropriate)
  const mixTotals = (() => {
    let totCount = 0, totSF = 0, totRent = 0 /* count × monthly rent */
    for (const u of unitMixRows) {
      const ct   = Number(u.count ?? u.units ?? 0) || 0
      const sf   = Number(u.avg_sf ?? u.sf ?? 0) || 0
      const rent = Number(u.avg_rent ?? u.rent ?? u.monthly_rent ?? 0) || 0
      totCount += ct
      totSF    += ct * sf
      totRent  += ct * rent
    }
    return {
      count: totCount,
      total_sf: totSF,
      avg_sf: totCount > 0 ? totSF / totCount : null,
      avg_rent: totCount > 0 ? totRent / totCount : null,
      rent_psf: totSF > 0 ? (totRent * 12) / (totSF * 12) : null,  // i.e. avg_rent / avg_sf
      gpr_annual: totRent * 12,
    }
  })()
  const totalSF = s4.total_sf || mixTotals.total_sf || null

  const docs = scenario.source_documents || scenario.docs || []

  const onBackdrop = (e) => { if (e.target === e.currentTarget) onClose() }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex justify-end" onClick={onBackdrop}>
      <div className="w-full max-w-3xl h-full overflow-y-auto bg-cw-dark border-l border-cw-border shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-cw-dark border-b border-cw-border px-6 py-4 flex items-start justify-between z-10">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">{scenario.name || scenario.id}</h2>
              {scenario.primary && <span className="text-[10px] uppercase tracking-wide bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">Primary</span>}
              {scenario.archived && <span className="text-[10px] uppercase tracking-wide bg-gray-500/20 text-gray-400 px-1.5 py-0.5 rounded">Archived</span>}
            </div>
            {scenario.summary && <div className="text-sm text-gray-400 mt-1">{scenario.summary}</div>}
            <div className="text-xs text-gray-500 mt-1">
              {scenario.product_type} · {scenario.created_at}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Headline metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <MetricBox label="Units" value={units ?? '—'} sub={scenario.product_type} />
            <MetricBox label="TDC" value={fmtMoneyM(tdc)} sub={units ? `${fmtMoney(tdc / units)}/unit` : null} />
            <MetricBox label="YoC" value={fmtPct(yoc)} sub={s8.target_yoc ? `Target ${fmtPct(s8.target_yoc)}` : null} />
            <MetricBox label="DSCR" value={fmtX(dscr)} />
            <MetricBox label="Levered IRR" value={fmtPct(irr)} />
            <MetricBox label="Equity Multiple" value={fmtX(em)} sub={devSpread != null ? `Dev spread ${devSpread > 0 ? '+' : ''}${devSpread}bps` : null} />
          </div>

          {/* Unit Mix */}
          <Section title="Unit Mix" icon={Home}>
            {unitMixRows.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-cw-border">
                    <th className="py-1.5 pr-3">Type</th>
                    <th className="py-1.5 pr-3 text-right">Count</th>
                    <th className="py-1.5 pr-3 text-right">Mix %</th>
                    <th className="py-1.5 pr-3 text-right">Avg SF</th>
                    <th className="py-1.5 pr-3 text-right">Avg Rent</th>
                    <th className="py-1.5 pr-3 text-right">Rent/SF</th>
                    <th className="py-1.5 pr-3 text-right">GPR / yr</th>
                  </tr>
                </thead>
                <tbody>
                  {unitMixRows.map((u, i) => {
                    const t = u.type || u.unit_type || u.name
                    const ct = u.count ?? u.units
                    const sf = u.avg_sf ?? u.sf
                    const rent = u.avg_rent ?? u.rent ?? u.monthly_rent
                    const rpsf = u.rent_psf ?? (rent && sf ? rent / sf : null)
                    const mixPct = u.pct ?? (ct && mixTotals.count ? (ct / mixTotals.count) * 100 : null)
                    const gprYr = (ct && rent) ? ct * rent * 12 : null
                    return (
                      <tr key={i} className="border-b border-cw-border/50">
                        <td className="py-1.5 pr-3 text-gray-200">{t}</td>
                        <td className="py-1.5 pr-3 text-right">{ct}</td>
                        <td className="py-1.5 pr-3 text-right text-gray-400">{mixPct != null ? `${Math.round(mixPct)}%` : '—'}</td>
                        <td className="py-1.5 pr-3 text-right">{sf ? sf.toLocaleString() : '—'}</td>
                        <td className="py-1.5 pr-3 text-right">{rent ? `$${Math.round(rent).toLocaleString()}` : '—'}</td>
                        <td className="py-1.5 pr-3 text-right text-gray-400">{rpsf ? `$${Number(rpsf).toFixed(2)}` : '—'}</td>
                        <td className="py-1.5 pr-3 text-right text-gray-400">{gprYr ? fmtMoneyM(gprYr) : '—'}</td>
                      </tr>
                    )
                  })}
                  {/* Total / weighted-avg row */}
                  <tr className="border-t-2 border-cw-border font-semibold">
                    <td className="py-2 pr-3 text-gray-100">Total / Avg</td>
                    <td className="py-2 pr-3 text-right">{mixTotals.count}</td>
                    <td className="py-2 pr-3 text-right text-gray-400">100%</td>
                    <td className="py-2 pr-3 text-right">{mixTotals.avg_sf ? Math.round(mixTotals.avg_sf).toLocaleString() : '—'}</td>
                    <td className="py-2 pr-3 text-right">{mixTotals.avg_rent ? `$${Math.round(mixTotals.avg_rent).toLocaleString()}` : '—'}</td>
                    <td className="py-2 pr-3 text-right text-gray-400">{mixTotals.rent_psf ? `$${mixTotals.rent_psf.toFixed(2)}` : '—'}</td>
                    <td className="py-2 pr-3 text-right text-gray-200">{mixTotals.gpr_annual ? fmtMoneyM(mixTotals.gpr_annual) : '—'}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <div className="text-xs text-gray-500 italic">No unit mix recorded.</div>
            )}
            <div className="text-xs text-gray-500 mt-2">
              {totalSF && <>Total SF: <span className="text-gray-300">{Math.round(totalSF).toLocaleString()}</span></>}
              {(s4.gpr_annual || s4.gross_potential_rent) && <> · GPR: <span className="text-gray-300">{fmtMoneyM(s4.gpr_annual ?? s4.gross_potential_rent)}/yr</span></>}
              {s4.avg_rent && <> · Avg rent: <span className="text-gray-300">${Math.round(s4.avg_rent).toLocaleString()}/u/mo</span></>}
              {s4.avg_unit_sf && <> · Avg unit SF: <span className="text-gray-300">{Math.round(s4.avg_unit_sf).toLocaleString()}</span></>}
            </div>
          </Section>

          {/* NOI — reads multiple schema variants; vacancy_pct can be stored
              as whole number (6.0 meaning 6%) — normPct handles it. */}
          <Section title="NOI Underwriting" icon={Calculator}>
            {(() => {
              const gpr = s5.gpr ?? s5.gross_potential_rent
              // vacancy rate — try every variant; normalize
              const vacRate = normPct(s5.vacancy_rate ?? s5.vacancy ?? s5.vacancy_pct ?? s5.rent_assumptions?.vacancy_rate)
              const vacLossDollars = (vacRate != null && gpr != null) ? gpr * vacRate : null
              const oi = s5.other_income
              const oiPct = s5.other_income_pct ?? s5.other_income_pct_of_gpr
              const concessions = s5.concessions
              const egi = s5.egi ?? s5.effective_gross_income
              const oe = s5.operating_expenses || {}
              const totalOpex = s5.total_opex ?? s5.operating_expenses_total ?? oe.total_opex
              const mgmtPct = normPct(s5.property_mgmt_pct ?? oe.property_mgmt_pct_egi ?? oe.management_fee_rate)
              const noi = s5.noi ?? s5.stabilized_noi ?? s5.noi_total
              const opexPerUnit = s5.opex_per_unit ?? (totalOpex && units ? totalOpex / units : null)
              const expenseRatio = s5.expense_ratio ?? s5.opex_ratio ?? (totalOpex && egi ? totalOpex / egi : null)

              // Controllables vs non-controllables per CWP methodology:
              //   Controllables: payroll, admin/office, advertising/marketing, contracts,
              //     turnover/turn, repairs_maintenance, utilities_owner/utilities
              //   Non-controllables: management fee, insurance, property taxes, and any
              //     fixed/pass-through expenses (garage share, gross receipts tax, etc.)
              // Read from multiple key variants used across deals.
              const pick = (...keys) => {
                for (const k of keys) {
                  const v = s5[k] ?? oe[k]
                  if (v != null && isFinite(v)) return Number(v)
                }
                return 0
              }
              const ctrlParts = {
                payroll: pick('payroll'),
                admin: pick('admin', 'office_admin', 'office_administrative', 'general_admin'),
                marketing: pick('advertising', 'marketing', 'marketing_advertising'),
                contracts: pick('contracts', 'contract_services'),
                turnover: pick('turnover', 'turn', 'turnover_costs'),
                rm: pick('repairs_maintenance', 'r_and_m', 'repairs', 'maintenance'),
                utilities: pick('utilities_owner', 'utilities', 'owner_utilities'),
              }
              const controllables = Object.values(ctrlParts).reduce((a, b) => a + b, 0)
              const nonControllables = (totalOpex && totalOpex > controllables)
                ? totalOpex - controllables
                : (pick('property_mgmt', 'management_fee') +
                   pick('insurance') +
                   pick('real_estate_taxes', 'taxes', 'property_taxes'))
              const ctrlPerUnit = (units && controllables > 0) ? controllables / units : null
              const nonCtrlPerUnit = (units && nonControllables > 0) ? nonControllables / units : null
              const ctrlPctOpex = (totalOpex && controllables > 0) ? controllables / totalOpex : null

              return (
                <KVTable rows={[
                  ['Gross Potential Rent', gpr ? `${fmtMoneyM(gpr)} / yr` : '—'],
                  ['Vacancy (rate)', vacRate != null ? `${(vacRate * 100).toFixed(2)}%` : '—'],
                  ['Vacancy loss ($)', vacLossDollars != null ? `(${fmtMoneyM(vacLossDollars)})` : null],
                  ['Concessions', concessions ? `(${fmtMoneyM(concessions)})` : null],
                  ['Other Income', oi ? `${fmtMoneyM(oi)}${oiPct ? ` (${(normPct(oiPct) * 100).toFixed(1)}% of GPR)` : ''}` : null],
                  ['Effective Gross Income', egi ? `${fmtMoneyM(egi)} / yr` : '—'],
                  ['Management fee', mgmtPct != null ? `${(mgmtPct * 100).toFixed(2)}% of EGI` : null],
                  ['Controllables', controllables > 0 ? (
                    <span className="text-gray-200">
                      {fmtMoneyM(controllables)}
                      {ctrlPerUnit ? <span className="text-gray-500"> · {fmtMoney(ctrlPerUnit)}/unit</span> : null}
                      {ctrlPctOpex != null ? <span className="text-gray-500"> · {(ctrlPctOpex * 100).toFixed(0)}% of OpEx</span> : null}
                    </span>
                  ) : null],
                  ['Non-Controllables', nonControllables > 0 ? (
                    <span className="text-gray-200">
                      {fmtMoneyM(nonControllables)}
                      {nonCtrlPerUnit ? <span className="text-gray-500"> · {fmtMoney(nonCtrlPerUnit)}/unit</span> : null}
                      {ctrlPctOpex != null ? <span className="text-gray-500"> · {((1 - ctrlPctOpex) * 100).toFixed(0)}% of OpEx</span> : null}
                    </span>
                  ) : null],
                  ['Total Operating Expenses', totalOpex ? fmtMoneyM(totalOpex) : '—'],
                  ['Opex / unit', opexPerUnit ? fmtMoney(opexPerUnit) : null],
                  ['Expense Ratio', expenseRatio != null ? `${(expenseRatio * 100).toFixed(1)}%` : null],
                  ['Stabilized NOI', <span className="font-semibold text-emerald-300">{fmtMoneyM(noi)}</span>],
                  ['NOI / unit', (noi && units) ? fmtMoney(noi / units) : null],
                ]} />
              )
            })()}
            <StabilizedValueBox noi={s5.noi ?? s5.stabilized_noi ?? s5.noi_total} tdc={tdc} units={units} />
          </Section>

          {/* Dev costs — full line-item table with per-unit and per-SF columns */}
          <Section title="Development Budget" icon={Building2}>
            {(() => {
              const tSF = totalSF  // computed above from s4.total_sf or unit-mix aggregate
              // Each row: [label, total, optional explicit per_unit, optional explicit per_sf]
              // If per-unit / per-sf are null, we derive from total/units/totalSF.
              const rows = [
                ['Land',                    s6.land?.total ?? s6.land_cost,                           s6.land_per_unit, null, s6.land_per_acre != null ? `$${Math.round(s6.land_per_acre).toLocaleString()}/ac` : null],
                ['Hard Costs',              s6.hard_costs?.total ?? s6.hard_cost_total,               s6.hard_cost_per_unit, s6.hard_cost_per_sf],
                ['  Site Work',             s6.site_work],
                ['  Amenity Package',       s6.amenity_package],
                ['Soft Costs',              s6.soft_costs?.total ?? s6.soft_cost_total,               s6.soft_cost_per_unit, null, s6.soft_cost_pct_hard != null ? `${s6.soft_cost_pct_hard}% of hard` : null],
                ['  Arch + Engineering',    s6.arch_engineering],
                ['  Permits + Impact Fees', s6.permits_impact_fees,                                   s6.permits_impact_fees_per_unit],
                ['  Legal',                 s6.legal],
                ['  Marketing / Lease-up',  s6.marketing_leaseup,                                     s6.marketing_leaseup_per_unit],
                ['  Developer Fee',         s6.developer_fee],
                ['Carry / Proffers',        s6.carry_proffers,                                        s6.carry_proffers_per_unit],
                ['Financing Costs',         s6.financing_costs?.total ?? s6.financing_costs],
                ['Contingency',             s6.contingency?.total ?? s6.contingency_total ?? s6.contingency, null, null, s6.contingency_pct != null ? `${s6.contingency_pct}%` : null],
              ].filter(r => r[1] != null && r[1] !== 0 && r[1] !== '')
              const derive = (v, div) => (v != null && div) ? v / div : null
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b border-cw-border">
                        <th className="py-1.5 pr-3">Line</th>
                        <th className="py-1.5 pr-3 text-right">Total</th>
                        <th className="py-1.5 pr-3 text-right">$/unit</th>
                        <th className="py-1.5 pr-3 text-right">$/SF</th>
                        <th className="py-1.5 pr-3 text-right">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(([label, total, pu, psf, note], i) => {
                        const perUnit = pu ?? derive(total, units)
                        const perSF   = psf ?? derive(total, tSF)
                        const isSub   = typeof label === 'string' && label.startsWith('  ')
                        return (
                          <tr key={i} className="border-b border-cw-border/40">
                            <td className={`py-1.5 pr-3 ${isSub ? 'text-gray-400 pl-3' : 'text-gray-200'}`}>{String(label).trim()}</td>
                            <td className="py-1.5 pr-3 text-right">{fmtMoneyM(total)}</td>
                            <td className="py-1.5 pr-3 text-right text-gray-400">{perUnit ? fmtMoney(perUnit) : '—'}</td>
                            <td className="py-1.5 pr-3 text-right text-gray-400">{perSF ? `$${perSF.toFixed(2)}` : '—'}</td>
                            <td className="py-1.5 pr-3 text-right text-gray-500 text-xs">{note || ''}</td>
                          </tr>
                        )
                      })}
                      <tr className="border-t-2 border-cw-border font-semibold">
                        <td className="py-2 pr-3 text-gray-100">Total Dev Cost</td>
                        <td className="py-2 pr-3 text-right text-emerald-300">{fmtMoneyM(tdc)}</td>
                        <td className="py-2 pr-3 text-right text-gray-300">{(tdc && units) ? fmtMoney(tdc / units) : '—'}</td>
                        <td className="py-2 pr-3 text-right text-gray-300">{(tdc && tSF) ? `$${(tdc / tSF).toFixed(2)}` : '—'}</td>
                        <td className="py-2 pr-3 text-right"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )
            })()}
            <StabilizedValueBox noi={s5.noi ?? s5.stabilized_noi ?? s5.noi_total} tdc={tdc} units={units} />
          </Section>

          {/* Financing — reads recommended_path + scenarios[] details */}
          <Section title="Financing" icon={Landmark}>
            {(() => {
              const rec = s7.recommended_path || {}
              const fsc = Array.isArray(s7.scenarios) ? s7.scenarios[0] : null
              const construction = fsc?.construction_loan || {}
              const perm = fsc?.permanent_loan || {}
              const progName = rec.name ?? s7.selected_program ?? s7.program ?? s7.path ?? fsc?.path
              // Prefer top-level rec for headline; fall back to scenarios[0] details
              const ltv = rec.ltv ?? perm.ltv_pct ?? s7.ltv
              const ltc = rec.ltc ?? construction.ltc_pct ?? s7.ltc
              const rate = rec.interest_rate ?? rec.rate ?? perm.rate ?? s7.rate ?? s7.interest_rate
              const loanAmt = rec.loan_amount ?? perm.loan_jtm_underwrite ?? construction.loan_amount ?? s7.loan_amount
              const amort = rec.amortization_years ?? perm.amortization_years ?? s7.amortization_years
              const io = rec.io_period_months ?? (perm.io_period_years ? perm.io_period_years * 12 : null)
              const term = rec.loan_term_years ?? s7.loan_term_years
              const ads = s7.annual_debt_service ?? s7.debt_service
              const equity = s7.equity_required ?? s7.equity
              return (
                <>
                  <KVTable rows={[
                    ['Recommended Path', progName],
                    ['LTV', fmtPct(ltv)],
                    ['LTC', fmtPct(ltc)],
                    ['Loan Amount', fmtMoneyM(loanAmt)],
                    ['Rate', fmtPct(rate)],
                    ['Amortization', amort ? `${amort} yrs` : null],
                    ['IO Period', io ? `${io} mo` : null],
                    ['Loan Term', term ? `${term} yrs` : null],
                    ['Annual Debt Service', fmtMoneyM(ads)],
                    ['Equity Required', fmtMoneyM(equity)],
                  ]} />
                  {(construction.loan_amount || perm.loan_jtm_underwrite || perm.rate) && (
                    <div className="mt-4 grid md:grid-cols-2 gap-3">
                      {(construction.loan_amount || construction.rate) && (
                        <div className="bg-cw-dark/40 border border-cw-border rounded p-3">
                          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Construction Loan</div>
                          <KVTable rows={[
                            ['LTC', fmtPct(construction.ltc_pct)],
                            ['Loan', fmtMoneyM(construction.loan_amount)],
                            ['Rate', fmtPct(construction.rate)],
                            ['Term', construction.term_months ? `${construction.term_months} mo` : null],
                            ['Avg Draw', fmtPct(construction.avg_draw_pct)],
                            ['Construction Interest', fmtMoneyM(construction.construction_interest)],
                            ['Fees', fmtPct(construction.fees_pct)],
                          ]} />
                        </div>
                      )}
                      {(perm.rate || perm.loan_jtm_underwrite) && (
                        <div className="bg-cw-dark/40 border border-cw-border rounded p-3">
                          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Permanent Loan</div>
                          <KVTable rows={[
                            ['LTV', fmtPct(perm.ltv_pct)],
                            ['Rate', fmtPct(perm.rate)],
                            ['Amortization', perm.amortization_years ? `${perm.amortization_years} yrs` : null],
                            ['IO Period', perm.io_period_years ? `${perm.io_period_years} yrs` : null],
                            ['Min DSCR', perm.min_dscr ? `${perm.min_dscr}x` : null],
                            ['Loan (underwrite)', fmtMoneyM(perm.loan_jtm_underwrite)],
                          ]} />
                        </div>
                      )}
                    </div>
                  )}
                  {rec.notes && (
                    <div className="mt-3 text-xs text-gray-400 italic whitespace-pre-wrap">{rec.notes}</div>
                  )}
                </>
              )
            })()}
          </Section>

          {/* Step 9 Strategy */}
          {(s9.highest_best_use || s9.recommendation_summary || s9.go_no_go) && (
            <Section title="Strategy & Recommendation" icon={Target}>
              <div className="space-y-3 text-sm text-gray-200 leading-relaxed">
                {s9.go_no_go && (
                  <div className="text-xs uppercase tracking-wide">
                    <span className="text-gray-500">Verdict: </span>
                    <span className="text-emerald-300 font-semibold">{s9.go_no_go}</span>
                  </div>
                )}
                {s9.highest_best_use && (
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Highest & Best Use</div>
                    <CitedText text={s9.highest_best_use} sources={sources} />
                  </div>
                )}
                {s9.recommendation_summary && (
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Summary</div>
                    <CitedText text={s9.recommendation_summary} sources={sources} />
                  </div>
                )}
                {Array.isArray(s9.top_risks) && s9.top_risks.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Top Risks</div>
                    <ul className="list-disc pl-5 space-y-1">
                      {s9.top_risks.map((r, i) => (
                        <li key={i}><CitedText text={typeof r === 'string' ? r : (r.risk || r.text || JSON.stringify(r))} sources={sources} /></li>
                      ))}
                    </ul>
                  </div>
                )}
                {Array.isArray(s9.competitive_advantages) && s9.competitive_advantages.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Competitive Advantages</div>
                    <ul className="list-disc pl-5 space-y-1">
                      {s9.competitive_advantages.map((c, i) => (
                        <li key={i}><CitedText text={typeof c === 'string' ? c : (c.advantage || c.text || JSON.stringify(c))} sources={sources} /></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Source documents (e.g. Excel models) */}
          {docs.length > 0 && (
            <Section title="Model Documents" icon={FileText}>
              <ul className="space-y-2 text-sm">
                {docs.map((d, i) => (
                  <li key={i}>
                    {d.url ? (
                      <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-emerald-300 hover:text-emerald-200 underline">
                        {d.label || d.url}
                      </a>
                    ) : (
                      <span className="text-gray-300">{d.label || d.path}</span>
                    )}
                    {d.note && <span className="text-xs text-gray-500 ml-2">— {d.note}</span>}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Scenarios (multi-model per deal)
// ────────────────────────────────────────────────────────────────

function ScenariosTable({ data, sources }) {
  const [open, setOpen] = useState(null)
  let scenarios = []
  try {
    scenarios = typeof data === 'string' ? JSON.parse(data) : data
  } catch { return null }
  if (!Array.isArray(scenarios) || scenarios.length === 0) return null

  // Detect already-percent values (|v| >= 1) so legacy deal-states don't render 566%.
  const fmtPct = (v) => {
    if (v === null || v === undefined || !isFinite(v)) return '—'
    if (v === 0) return '0.00%'
    if (Math.abs(v) >= 1) return `${Number(v).toFixed(2)}%`
    return `${(v * 100).toFixed(2)}%`
  }
  const fmtMoneyM = (v) => (v || v === 0) ? `$${(v / 1e6).toFixed(2)}M` : '—'

  const summarize = (s) => {
    const s4 = s.step_4_unit_mix || {}
    const s6 = s.step_6_dev_costs || {}
    const s8 = s.step_8_returns || {}
    const s9 = s.step_9_strategy || {}
    const units = s4.total_units ?? s.units
    const tdc = s6.total_dev_cost?.tdc_total ?? s6.tdc_total ?? s6.tdc
    const yoc = s8.yield_on_cost ?? s8.yoc ?? s6.feasibility_analysis?.implied_yoc_at_tdc
    const dscr = s8.dscr_amortizing ?? s8.dscr
    const irr = s8.levered_irr ?? s8.irr_levered
    const verdict = s9.go_no_go ?? s.verdict ?? s.summary?.slice(0, 60)
    const product = s4.product_type ?? s.product_type
    return { units, product, tdc, yoc, dscr, irr, verdict }
  }

  // Sort: primary first, then non-archived by created_at desc, then archived.
  const sorted = [...scenarios].sort((a, b) => {
    if (a.primary && !b.primary) return -1
    if (b.primary && !a.primary) return 1
    if (a.archived && !b.archived) return 1
    if (b.archived && !a.archived) return -1
    return (b.created_at || '').localeCompare(a.created_at || '')
  })

  return (
    <Section title="Scenarios" icon={Target}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-cw-border">
              <th className="py-2 pr-3">Scenario</th>
              <th className="py-2 pr-3">Units</th>
              <th className="py-2 pr-3">Product</th>
              <th className="py-2 pr-3">TDC</th>
              <th className="py-2 pr-3">YoC</th>
              <th className="py-2 pr-3">DSCR</th>
              <th className="py-2 pr-3">IRR</th>
              <th className="py-2 pr-3">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              const summary = summarize(s)
              const base = 'border-b border-cw-border cursor-pointer hover:bg-cw-dark/70 transition-colors'
              const rowClass = s.primary
                ? `bg-emerald-500/5 ${base}`
                : s.archived
                ? `opacity-60 ${base}`
                : base
              return (
                <tr key={s.id || i} className={rowClass} onClick={() => setOpen(s)}>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.name || s.id || `Scenario ${i + 1}`}</span>
                      {s.primary && <span className="text-[10px] uppercase tracking-wide bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">Primary</span>}
                      {s.archived && !s.primary && <span className="text-[10px] uppercase tracking-wide bg-gray-500/20 text-gray-400 px-1.5 py-0.5 rounded">Archived</span>}
                    </div>
                    {s.created_at && <div className="text-xs text-gray-500 mt-0.5">{s.created_at}</div>}
                  </td>
                  <td className="py-2 pr-3">{summary.units ?? '—'}</td>
                  <td className="py-2 pr-3 text-gray-300">{summary.product || '—'}</td>
                  <td className="py-2 pr-3">{fmtMoneyM(summary.tdc)}</td>
                  <td className="py-2 pr-3">{fmtPct(summary.yoc)}</td>
                  <td className="py-2 pr-3">{summary.dscr ? `${Number(summary.dscr).toFixed(2)}x` : '—'}</td>
                  <td className="py-2 pr-3">{fmtPct(summary.irr)}</td>
                  <td className="py-2 pr-3 text-xs text-gray-400">{summary.verdict || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-gray-500 mt-3">
        Key Metrics above reflect the <span className="text-emerald-400">primary</span> scenario. Click a row to see unit mix, NOI, dev budget, financing, and strategy details.
      </div>
      <SensitivityCard scenarios={scenarios} />
      {open && <ScenarioDetailDrawer scenario={open} sources={sources} onClose={() => setOpen(null)} />}
    </Section>
  )
}

function NarrativeSection({ title, icon, text, placeholder, sources }) {
  if (!text || !text.trim()) {
    return (
      <Section title={title} icon={icon}>
        <div className="text-sm text-gray-500 italic">{placeholder}</div>
      </Section>
    )
  }
  return (
    <Section title={title} icon={icon}>
      <div className="space-y-3 text-sm text-gray-200 leading-relaxed">
        <CitedText text={text} sources={sources} />
      </div>
    </Section>
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

// ────────────────────────────────────────────────────────────────
// SmartJSON — human-readable renderer for step-output JSON blobs
// ────────────────────────────────────────────────────────────────
//
// Replaces <pre>{JSON.stringify(...)}</pre> with a structured recursive
// renderer. Design intent:
//   - Scalars render in a 2-col field grid (label + value)
//   - Arrays of objects with overlapping keys render as compact tables
//   - Arrays of strings render as bullet lists; URLs become links
//   - Nested objects become sub-sections with a title
//   - Hidden/internal keys (_contract, _description, status, completed_at)
//     are skipped from the body — those already have their own UI chrome
//   - Money/percent/date/URL detection makes the output scannable
//
// Applied in StepSection so every step output gets the upgrade automatically.

const SMART_SKIP_KEYS = new Set([
  '_contract', '_description', '_usage', '_contract_spec',
  'status', 'completed_at',
])

function smartTitleize(k) {
  if (!k) return ''
  // "gross_potential_rent" -> "Gross Potential Rent"
  // "step_3_market" -> "Step 3 Market"
  return k.replace(/_/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())
          .replace(/\bSf\b/g, 'SF')
          .replace(/\bNoi\b/g, 'NOI')
          .replace(/\bLtv\b/g, 'LTV')
          .replace(/\bLtc\b/g, 'LTC')
          .replace(/\bDscr\b/g, 'DSCR')
          .replace(/\bYoc\b/g, 'YoC')
          .replace(/\bIrr\b/g, 'IRR')
          .replace(/\bMsa\b/g, 'MSA')
          .replace(/\bGpr\b/g, 'GPR')
          .replace(/\bHud\b/g, 'HUD')
          .replace(/\bVhda\b/g, 'VHDA')
          .replace(/\bBtr\b/g, 'BTR')
          .replace(/\bOm\b/g, 'OM')
          .replace(/\bUrl\b/g, 'URL')
          .replace(/\bAcs\b/g, 'ACS')
          .replace(/\bBls\b/g, 'BLS')
          .replace(/\bDot\b/g, 'DOT')
          .replace(/\bPsf\b/g, 'PSF')
          .replace(/\bNwi\b/g, 'NWI')
          .replace(/\bFema\b/g, 'FEMA')
          .replace(/\bEpa\b/g, 'EPA')
          .replace(/\bCbsa\b/g, 'CBSA')
}

// Key-based hints for formatting scalar values. Matches are case-insensitive
// substring checks.
const MONEY_HINTS    = ['price', 'cost', 'rent', 'noi', 'gpr', 'egi', 'basis', 'value', 'income', 'expense', 'proceeds', 'tdc', 'debt', 'equity', 'capex', 'fee', '_psf', 'psf', 'reserve', 'concession']
const PCT_HINTS      = ['rate', 'pct', 'percent', 'ratio', 'vacancy', 'ltv', 'ltc', 'share', 'margin']
const COUNT_HINTS    = ['units', 'count', 'sf', 'sq_ft', 'sqft', 'months', 'years', 'yrs', 'population', 'speakers']
const DATE_HINTS     = ['date', '_at', 'timestamp']
const URL_HINTS      = ['url', 'link', 'href', 'source']

function hintMatch(key, hints) {
  const k = (key || '').toLowerCase()
  return hints.some(h => k === h || k.endsWith('_' + h) || k.includes(h))
}

function isUrlString(s) {
  return typeof s === 'string' && /^https?:\/\//i.test(s)
}

function formatSmartScalar(key, val) {
  if (val === null || val === undefined || val === '') return <span className="text-gray-600">—</span>
  if (typeof val === 'boolean') {
    return val
      ? <span className="text-cw-green">✓ yes</span>
      : <span className="text-gray-500">✗ no</span>
  }
  if (typeof val === 'string') {
    if (isUrlString(val)) {
      const short = val.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 60)
      return <a href={val} target="_blank" rel="noopener noreferrer" className="text-cw-accent hover:underline break-all">{short}{val.length > 65 ? '…' : ''}</a>
    }
    // Try to pretty-print long prose inline; keep short strings as-is
    return <span className="whitespace-pre-wrap break-words">{fixMojibake(val)}</span>
  }
  if (typeof val === 'number') {
    // Percent: values between 0-1 with percent-hint key, OR >1 with percent hint but <=100
    if (hintMatch(key, PCT_HINTS)) {
      if (val > 0 && val <= 1) return `${(val * 100).toFixed(2)}%`
      if (val > 1 && val <= 100) return `${val.toFixed(2)}%`
      return val.toString()
    }
    if (hintMatch(key, MONEY_HINTS)) {
      if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`
      if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(2)}M`
      if (Math.abs(val) >= 1e3) return `$${Math.round(val).toLocaleString()}`
      return `$${val.toLocaleString()}`
    }
    if (hintMatch(key, COUNT_HINTS)) {
      return Math.round(val).toLocaleString()
    }
    // Generic number
    if (Number.isInteger(val)) return val.toLocaleString()
    return val.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  // Fallback for exotic types
  return <span className="font-mono text-xs">{JSON.stringify(val)}</span>
}

// Detect whether an array of objects is "table-shaped" — shares ≥2 keys
// across items so a grid layout is meaningful.
function isTableShaped(arr) {
  if (!Array.isArray(arr) || arr.length < 2) return false
  if (!arr.every(x => x && typeof x === 'object' && !Array.isArray(x))) return false
  const keyCounts = {}
  arr.forEach(o => Object.keys(o).forEach(k => { keyCounts[k] = (keyCounts[k] || 0) + 1 }))
  const common = Object.entries(keyCounts).filter(([, c]) => c >= Math.max(2, Math.floor(arr.length * 0.5)))
  return common.length >= 2
}

function SmartTable({ rows }) {
  // Union of keys across rows, ordered by frequency
  const counts = {}
  rows.forEach(o => Object.keys(o).forEach(k => { counts[k] = (counts[k] || 0) + 1 }))
  const cols = Object.entries(counts)
    .filter(([k]) => !SMART_SKIP_KEYS.has(k))
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .slice(0, 8) // cap at 8 cols so table stays scannable
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[400px]">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-cw-border">
            {cols.map(c => <th key={c} className="py-1.5 pr-3 font-medium">{smartTitleize(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-cw-border/40 align-top">
              {cols.map(c => {
                const v = r[c]
                return (
                  <td key={c} className="py-1.5 pr-3">
                    {v && typeof v === 'object'
                      ? <SmartJSON data={v} depth={2} inline />
                      : formatSmartScalar(c, v)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SmartArray({ arr, parentKey }) {
  if (arr.length === 0) return <span className="text-gray-600 text-sm italic">none</span>
  // All scalars → bullet list (URLs become links)
  if (arr.every(x => x === null || typeof x !== 'object')) {
    return (
      <ul className="list-disc ml-5 space-y-1 text-sm">
        {arr.map((v, i) => <li key={i}>{formatSmartScalar(parentKey, v)}</li>)}
      </ul>
    )
  }
  // Table-shaped → compact table
  if (isTableShaped(arr)) {
    return <SmartTable rows={arr} />
  }
  // Mixed / deep → render each item as a mini card
  return (
    <div className="space-y-2">
      {arr.map((v, i) => (
        <div key={i} className="bg-cw-dark/40 border border-cw-border/60 rounded p-2">
          {v && typeof v === 'object'
            ? <SmartJSON data={v} depth={2} />
            : formatSmartScalar(parentKey, v)}
        </div>
      ))}
    </div>
  )
}

function SmartJSON({ data, depth = 0, inline = false }) {
  if (data === null || data === undefined) return null

  if (typeof data !== 'object') {
    return formatSmartScalar('', data)
  }

  if (Array.isArray(data)) {
    return <SmartArray arr={data} />
  }

  // Object: separate scalars from nested
  const entries = Object.entries(data).filter(([k]) => !SMART_SKIP_KEYS.has(k))
  if (entries.length === 0) return null

  const scalars = []
  const nested = []
  for (const [k, v] of entries) {
    if (v === null || typeof v !== 'object') {
      scalars.push([k, v])
    } else if (Array.isArray(v) && v.every(x => x === null || typeof x !== 'object')) {
      // array of scalars — render inline in the scalar grid if short
      if (v.length <= 3) scalars.push([k, v])
      else nested.push([k, v])
    } else {
      nested.push([k, v])
    }
  }

  // Inline mode (used inside table cells): flat listing, no section chrome
  if (inline) {
    return (
      <div className="space-y-1 text-xs">
        {scalars.map(([k, v]) => (
          <div key={k}>
            <span className="text-gray-500">{smartTitleize(k)}:</span>{' '}
            {Array.isArray(v)
              ? v.map((x, i) => <span key={i}>{i > 0 ? ', ' : ''}{formatSmartScalar(k, x)}</span>)
              : formatSmartScalar(k, v)}
          </div>
        ))}
        {nested.map(([k, v]) => (
          <div key={k}>
            <span className="text-gray-500">{smartTitleize(k)}:</span>{' '}
            <SmartJSON data={v} depth={depth + 1} inline />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {scalars.length > 0 && (
        <div className="grid grid-cols-[minmax(160px,1fr)_2fr] gap-x-4 gap-y-1.5 text-sm">
          {scalars.map(([k, v]) => (
            <React.Fragment key={k}>
              <div className="text-gray-500 pt-0.5">{smartTitleize(k)}</div>
              <div className="text-gray-200">
                {Array.isArray(v)
                  ? <span className="space-x-1">{v.map((x, i) => (
                      <span key={i}>
                        {formatSmartScalar(k, x)}{i < v.length - 1 ? ',' : ''}
                      </span>
                    ))}</span>
                  : formatSmartScalar(k, v)}
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
      {nested.map(([k, v]) => (
        <SmartSubsection key={k} title={smartTitleize(k)} depth={depth}>
          <SmartJSON data={v} depth={depth + 1} />
        </SmartSubsection>
      ))}
    </div>
  )
}

function SmartSubsection({ title, depth, children }) {
  // First-level nesting: always expanded (it's the main substance of the step)
  // Deeper nesting: collapsible, closed by default to keep the page scannable
  const [open, setOpen] = useState(depth < 1)
  if (depth < 1) {
    return (
      <div className="pt-1">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-2 border-b border-cw-border pb-1">{title}</div>
        {children}
      </div>
    )
  }
  return (
    <div className="pt-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs uppercase tracking-wide text-gray-500 mb-1 hover:text-gray-300 flex items-center gap-1"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {title}
      </button>
      {open && <div className="pl-3 border-l border-cw-border/60">{children}</div>}
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
        <div className="px-4 pb-4 pt-0">
          <div className="bg-cw-dark rounded-lg p-4">
            <SmartJSON data={parsed} />
          </div>
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
  const [gisEditing, setGisEditing] = useState(false)
  const [gisUrlDraft, setGisUrlDraft] = useState('')

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

  const saveGisUrl = async () => {
    await updateField('gis_url', gisUrlDraft.trim())
    setGisEditing(false)
  }

  if (loading || !deal) {
    return <div className="p-8 flex items-center justify-center h-full"><div className="text-gray-500">Loading deal...</div></div>
  }

  const m = deal.metrics || {}
  const fmt = (v, suffix = '') => v ? `${v}${suffix}` : '—'
  const fmtPct = (v) => {
    if (!v || !isFinite(v)) return '—'
    if (Math.abs(v) >= 1) return `${Number(v).toFixed(2)}%`
    return `${(v * 100).toFixed(2)}%`
  }
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
          <div className="text-sm text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{[deal.address, deal.city, deal.state].filter(Boolean).join(', ')}{deal.submarket ? ` · ${deal.submarket}` : ''}</span>
            {gisEditing ? (
              <span className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={gisUrlDraft}
                  onChange={e => setGisUrlDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveGisUrl(); if (e.key === 'Escape') setGisEditing(false) }}
                  className="bg-cw-dark border border-cw-border rounded px-2 py-0.5 text-xs text-white w-80"
                  placeholder="https://..."
                  autoFocus
                />
                <button onClick={saveGisUrl} className="text-xs text-green-400 hover:text-green-300">save</button>
                <button onClick={() => setGisEditing(false)} className="text-xs text-gray-600 hover:text-gray-400">cancel</button>
              </span>
            ) : deal.gis_url ? (
              <span className="flex items-center gap-1">
                <a href={deal.gis_url} target="_blank" rel="noopener noreferrer"
                   className="text-blue-400 hover:text-blue-300 text-xs underline underline-offset-2">GIS ↗</a>
                <button onClick={() => { setGisUrlDraft(deal.gis_url); setGisEditing(true) }}
                        className="text-gray-600 hover:text-gray-400" title="Edit GIS link">
                  <Edit3 className="w-3 h-3" />
                </button>
              </span>
            ) : (
              <button onClick={() => { setGisUrlDraft(''); setGisEditing(true) }}
                      className="text-gray-600 hover:text-gray-400 flex items-center gap-1 text-xs"
                      title="Add GIS link">
                <MapPin className="w-3 h-3" /><span>GIS</span>
              </button>
            )}
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

      {/* Correction notices — yellow banner when material revisions have been
          applied (e.g. rent comp correction, tax assessment correction). Pulls
          from any `corrections` array on the deal or its JSON sub-blobs.
          Renders nothing if no corrections present. */}
      <CorrectionNoticesBanner deal={deal} />

      {/* QuestionsForJack — top-of-page command center for blocking/open questions */}
      {(() => {
        let qs = deal.questions_for_jack
        if (typeof qs === 'string') { try { qs = JSON.parse(qs) } catch { qs = null } }
        return <QuestionsForJack questions={qs} />
      })()}

      {/* Deal Terms & Provenance — asking price + broker + key dates. Reads
          top-level flat columns first (legacy); falls back to provenance_data
          JSON blob populated by the deal-provenance sub-skill. Always
          renders (so "No asking price provided" is visible when absent). */}
      {(() => {
        const prov = parseMaybeJSON(deal.provenance_data) || {}
        const broker = prov.broker || {}
        const brokerName    = deal.broker_name    || broker.name
        const brokerCompany = deal.broker_company || broker.company
        const brokerEmail   = deal.broker_email   || broker.email
        const brokerPhone   = deal.broker_phone   || broker.phone
        const dListed    = deal.date_listed          || prov.listing_date
        const dCfo       = deal.date_cfo             || prov.cfo_date
        const dBestFinal = deal.date_best_final      || prov.best_and_final_date
        const dLoiSub    = deal.date_loi_submitted   || prov.loi_submitted_date
        const dLoiAcc    = deal.date_loi_accepted    || prov.loi_accepted_date
        const dOM        = prov.om_received_date
        const dateRow = (label, v) => v ? <div className="text-xs"><span className="text-gray-500">{label}</span> <span className="text-gray-200 font-mono ml-1">{v}</span></div> : null
        return (
          <div className="bg-cw-card border border-cw-border rounded-xl p-4">
            <div className="grid md:grid-cols-3 gap-4">
              {/* Asking price */}
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Asking Price</div>
                {deal.asking_price ? (
                  <>
                    <div className="text-2xl font-bold text-white">{fmtMoney(deal.asking_price)}</div>
                    {deal.asking_price_basis && (
                      <div className="text-xs text-gray-500 mt-0.5">{deal.asking_price_basis}</div>
                    )}
                  </>
                ) : (
                  <div className="text-base text-gray-500 italic">No asking price provided</div>
                )}
              </div>
              {/* Broker */}
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Broker</div>
                {brokerName || brokerCompany ? (
                  <div className="text-sm">
                    {brokerName && <div className="text-gray-200 font-semibold">{brokerName}</div>}
                    {brokerCompany && <div className="text-gray-300">{brokerCompany}</div>}
                    <div className="text-xs text-gray-500 mt-0.5">
                      {brokerEmail && <div>{brokerEmail}</div>}
                      {brokerPhone && <div>{brokerPhone}</div>}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">Not populated — run deal-provenance skill</div>
                )}
              </div>
              {/* Key dates */}
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Key Dates</div>
                {(dListed || dOM || dCfo || dBestFinal || dLoiSub || dLoiAcc) ? (
                  <div className="space-y-0.5">
                    {dateRow('Listed',        dListed)}
                    {dateRow('OM received',   dOM)}
                    {dateRow('CFO',           dCfo)}
                    {dateRow('Best & final',  dBestFinal)}
                    {dateRow('LOI submitted', dLoiSub)}
                    {dateRow('LOI accepted',  dLoiAcc)}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">Not populated — run deal-provenance skill</div>
                )}
              </div>
            </div>
            {prov.last_scan_at && (
              <div className="text-[10px] text-gray-600 mt-3">Last provenance scan: {prov.last_scan_at}</div>
            )}
          </div>
        )
      })()}


      {/* Phase Breakdown — hybrid acq+dev deals only; renders nothing otherwise */}
      <PhaseBreakdownCard data={deal.phase_context} />

      {/* Key Metrics */}
      <Section title="Key Metrics" icon={TrendingUp}>
        {m.incomplete && (
          <div className="mb-3 p-3 rounded-lg border border-yellow-900/50 bg-yellow-900/20 text-xs text-yellow-200">
            NOI-dependent metrics suppressed — step_5 (NOI underwriting) not yet populated.
            {m.incomplete_reason && <span className="text-yellow-400"> {m.incomplete_reason}.</span>}
            {' '}Basis / financing / $-per-unit metrics still shown below.
          </div>
        )}
        {(() => {
          // Jack's preference: headline should be YoC from the most recent
          // (primary) scenario rather than a going-in cap rate, since our
          // deals are predominantly development where the "purchase price"
          // on the DB row is actually TDC, which makes going-in-cap math
          // coincide with YoC but with a confusing label.
          const primaryScenarioYoc = (() => {
            try {
              const raw = deal.scenarios_data
              const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
              if (!Array.isArray(arr) || !arr.length) return null
              const sorted = [...arr].sort((a, b) => {
                if (a.primary && !b.primary) return -1
                if (b.primary && !a.primary) return 1
                if (a.archived && !b.archived) return 1
                if (b.archived && !a.archived) return -1
                return (b.created_at || '').localeCompare(a.created_at || '')
              })
              const top = sorted[0]
              const s8 = top?.step_8_returns || {}
              const s6 = top?.step_6_dev_costs || {}
              return s8.yield_on_cost ?? s8.yoc
                   ?? s6.feasibility_analysis?.implied_yoc_at_tdc ?? null
            } catch { return null }
          })()
          const displayYoc = primaryScenarioYoc ?? m.yield_on_cost
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              <MetricCard
                label={primaryScenarioYoc != null ? 'YoC (primary scenario)' : 'Yield on Cost'}
                value={fmtPct(displayYoc)}
                good={displayYoc >= 0.065} warn={displayYoc >= 0.060}
              />
              <MetricCard label="DSCR" value={m.dscr ? `${m.dscr.toFixed(2)}x` : '—'} good={m.dscr >= 1.25} warn={m.dscr >= 1.15} />
              <MetricCard label="Cash-on-Cash" value={fmtPct(m.cash_on_cash)} good={m.cash_on_cash >= 0.06} warn={m.cash_on_cash >= 0.04} />
              <MetricCard label="Levered IRR" value={fmtPct(m.levered_irr)} good={m.levered_irr >= 0.13} warn={m.levered_irr >= 0.10} />
              <MetricCard label="Equity Multiple" value={m.equity_multiple ? `${m.equity_multiple.toFixed(2)}x` : '—'} good={m.equity_multiple >= 1.8} warn={m.equity_multiple >= 1.5} />
              <MetricCard label="NOI" value={fmtMoney(m.noi)} />
              <MetricCard label="Price / Unit" value={fmtMoney(m.price_per_unit)} />
              <MetricCard label="Price / SF" value={fmtMoney(m.price_per_sf)} />
              <MetricCard label="Expense Ratio" value={fmtPct(m.expense_ratio)} />
            </div>
          )
        })()}
      </Section>

      {/* Scenarios (past & current models) */}
      {deal.scenarios_data && <ScenariosTable data={deal.scenarios_data} sources={deal.sources_data} />}

      {/* Base Case + Path to Better narrative */}
      {(deal.base_case_summary || deal.upside_path) && (
        <div className="grid md:grid-cols-2 gap-6">
          <NarrativeSection
            title="Base Case"
            icon={Landmark}
            text={deal.base_case_summary}
            sources={deal.sources_data}
            placeholder="No base case narrative yet — what is the site, what is it zoned/planned for, what does a by-right build-out look like?"
          />
          <NarrativeSection
            title="Path to Better"
            icon={Target}
            text={deal.upside_path}
            sources={deal.sources_data}
            placeholder="No upside path yet — what has to change (density, product mix, rent, cost) to get this deal to pencil, and what has to be true for it to work?"
          />
        </div>
      )}

      {/* Primary sources referenced from narrative */}
      {deal.sources_data && <SourcesList sources={deal.sources_data} />}

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

        <StepBlock n="2b" title="Demographics" icon={Users}>
          <DemographicsCard data={deal.demographics_data} />
          <StepSection title="Demographics output" icon={FileText} data={deal.demographics_data} stepKey="step_2b_demographics" />
          {!deal.demographics_data && <p className="text-sm text-gray-600 italic">No demographics analysis yet.</p>}
        </StepBlock>

        <StepBlock n="3" title="Market & Rent Comps" icon={LineChart}>
          <MarketContextCard data={deal.market_data} />
          <RentCompsCard data={deal.market_data} />
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
          <TaxCompsCard data={deal.noi_data} />
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
          <LocalityFeesCard data={deal.dev_cost_data} units={deal.units} />
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
