/**
 * CW Properties Pipeline API Worker
 * Cloudflare Worker with D1 database for deal pipeline management
 */

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

// Columns on the `deals` table that store JSON blobs. The Worker
// serializes objects to JSON strings on write; the frontend parses
// them on read. Keep this list in sync with d1-schema.sql and the
// fields/updatableFields arrays below.
const JSON_BLOB_FIELDS = new Set([
  'unit_mix',
  'entitlement_data',
  'zoning_data',
  'site_data',
  'demographics_data',
  'provenance_data',
  'market_data',
  'strategy_screen_data',
  'noi_data',
  'dev_cost_data',
  'financing_data',
  'returns_data',
  'strategy_data',
  'scenarios_data',
  'sources_data',
  'phase_context',
]);

// ────────────────────────────────────────────────────────────────
// Auth & Utility Functions
// ────────────────────────────────────────────────────────────────

function getUserFromRequest(request) {
  // Check both the original Access header and our custom proxy header
  const email = request.headers.get('Cf-Access-Authenticated-User-Email')
    || request.headers.get('X-Access-User-Email');
  if (!email) {
    return { email: 'local@dev.com', role: 'admin' };
  }

  const adminEmails = new Set([
    'jmiddleton@cwprop.com',
    'jackm@cwprop.com',
    'johnthomasva@gmail.com',
    'ford@cwprop.com',
    'macminicp@gmail.com'
  ]);

  const cleanEmail = email.toLowerCase().trim();
  const role = adminEmails.has(cleanEmail) || cleanEmail.endsWith('@cwprop.com') ? 'admin' : 'viewer';
  return { email: cleanEmail, role };
}

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cf-Access-Authenticated-User-Email',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

// ────────────────────────────────────────────────────────────────
// Financial Calculations
// ────────────────────────────────────────────────────────────────

// Normalize a percent-shaped field that might have been stored as a whole
// number (e.g. 6 for 6%) instead of a fraction (0.06). Conservative: only
// divides by 100 when the value is clearly in the 1–100 range where no
// sensible fraction would land.
function normalizePct(v) {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  // Anything > 1 on a pct field must have been written as whole-number %.
  if (n > 1) return n / 100;
  return n;
}

function calculateMetrics(deal) {
  const d = deal;
  const units = d.units || 0;
  const purchasePrice = d.purchase_price || 0;
  if (!purchasePrice || !units) return {};

  // Guardrail: detect "step_5 never populated" — all expense line items are
  // zero/null AND no override. Computing NOI from just GPR minus mgmt-fee-at-
  // default produces a phantom cap rate that matches no scenario. Better to
  // surface nothing than a wrong number. We still compute financing/basis
  // metrics that don't depend on NOI.
  const opexLineSum =
    (d.taxes || 0) + (d.insurance || 0) + (d.utilities || 0) +
    (d.repairs_maintenance || 0) + (d.payroll || 0) +
    (d.admin || 0) + (d.marketing || 0);
  const opexPopulated = opexLineSum > 0 || (d.total_expenses_override && d.total_expenses_override > 0);

  // Revenue — normalize vacancy_rate in case it was stored as 6 (meaning 6%)
  const gpr = d.gross_potential_rent || 0;
  const vacancyRate = normalizePct(d.vacancy_rate) ?? 0.05;
  const otherIncome = (d.other_income_per_unit || 0) * units;
  const concessions = (d.concessions_per_unit || 0) * units;
  const effectiveGrossIncome = gpr * (1 - vacancyRate) + otherIncome - concessions;

  // Expenses
  let totalExpenses;
  if (d.total_expenses_override) {
    totalExpenses = d.total_expenses_override;
  } else {
    const mgmtPct = normalizePct(d.management_fee_pct) ?? 0.03;
    const managementFee = effectiveGrossIncome * mgmtPct;
    const capexReserve = (d.capex_reserve_per_unit || 250) * units;
    totalExpenses = (d.taxes || 0) + (d.insurance || 0) + (d.utilities || 0) +
      (d.repairs_maintenance || 0) + managementFee + (d.admin || 0) +
      (d.payroll || 0) + (d.marketing || 0) + capexReserve;
  }

  const noi = effectiveGrossIncome - totalExpenses;

  // Acquisition
  const totalBasis = purchasePrice + (d.closing_costs || 0) + (d.capex_budget || 0);

  // Financing — normalize in case pct fields arrived as whole numbers
  const ltvFrac = normalizePct(d.ltv) ?? 0.65;
  const interestFrac = normalizePct(d.interest_rate) ?? 0.065;
  const loanAmount = purchasePrice * ltvFrac;
  const equity = totalBasis - loanAmount;
  const monthlyRate = interestFrac / 12;
  const numPayments = (d.amortization_years || 30) * 12;
  const monthlyPayment = monthlyRate > 0
    ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
    : loanAmount / numPayments;
  const annualDebtService = monthlyPayment * 12;

  // IO period adjustment
  const ioMonths = d.io_period_months || 0;
  const year1DebtService = ioMonths >= 12 ? loanAmount * interestFrac : annualDebtService;

  // Key metrics
  const goingInCapRate = purchasePrice > 0 ? noi / purchasePrice : 0;
  const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;
  const pricePerUnit = units > 0 ? purchasePrice / units : 0;
  const pricePerSF = d.total_sf > 0 ? purchasePrice / d.total_sf : 0;
  const cashFlow = noi - year1DebtService;
  const cashOnCash = equity > 0 ? cashFlow / equity : 0;
  const expenseRatio = effectiveGrossIncome > 0 ? totalExpenses / effectiveGrossIncome : 0;
  const expensePerUnit = units > 0 ? totalExpenses / units : 0;

  // Exit & return — normalize pct fields
  const exitCapRate = normalizePct(d.exit_cap_rate) ?? 0.055;
  const holdYears = d.hold_period_years || 5;
  const growthRate = 0.025; // 2.5% annual NOI growth assumption
  const exitNoi = noi * Math.pow(1 + growthRate, holdYears);
  const exitValue = exitCapRate > 0 ? exitNoi / exitCapRate : 0;
  const saleCosts = exitValue * (normalizePct(d.sale_costs_pct) ?? 0.02);

  // Remaining loan balance (simplified)
  let remainingBalance = loanAmount;
  for (let y = 0; y < holdYears; y++) {
    if (y * 12 < ioMonths) {
      // IO period - no principal paydown
    } else {
      const monthsThisYear = Math.min(12, numPayments - y * 12);
      for (let m = 0; m < monthsThisYear; m++) {
        const interestPortion = remainingBalance * monthlyRate;
        const principalPortion = monthlyPayment - interestPortion;
        remainingBalance -= principalPortion;
      }
    }
  }
  remainingBalance = Math.max(0, remainingBalance);

  const netProceeds = exitValue - saleCosts - remainingBalance;
  const equityMultiple = equity > 0 ? netProceeds / equity : 0;

  // Approximate levered IRR (Newton's method)
  let irr = 0.10; // initial guess
  const cashFlows = [-equity];
  for (let y = 1; y <= holdYears; y++) {
    const yearNoi = noi * Math.pow(1 + growthRate, y);
    const yearDs = y * 12 <= ioMonths ? loanAmount * interestFrac : annualDebtService;
    const yearCf = yearNoi - yearDs;
    if (y === holdYears) {
      cashFlows.push(yearCf + netProceeds);
    } else {
      cashFlows.push(yearCf);
    }
  }

  for (let iter = 0; iter < 100; iter++) {
    let npv = 0, dnpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      const disc = Math.pow(1 + irr, t);
      npv += cashFlows[t] / disc;
      if (t > 0) dnpv -= t * cashFlows[t] / Math.pow(1 + irr, t + 1);
    }
    if (Math.abs(dnpv) < 1e-10) break;
    const newIrr = irr - npv / dnpv;
    if (Math.abs(newIrr - irr) < 1e-8) { irr = newIrr; break; }
    irr = newIrr;
  }

  // Yield on cost
  const yieldOnCost = totalBasis > 0 ? noi / totalBasis : 0;

  // If step_5 was never populated (all opex line items zero / null), the
  // NOI-derived metrics below are meaningless phantom numbers — suppress
  // them. Basis / financing / exit metrics that don't depend on NOI still go
  // through. Caller should render these as "—" in the UI.
  if (!opexPopulated) {
    return {
      incomplete: true,
      incomplete_reason: 'step_5_noi not populated — expense line items are all zero',
      effective_gross_income: Math.round(effectiveGrossIncome),
      total_basis: Math.round(totalBasis),
      price_per_unit: Math.round(pricePerUnit),
      price_per_sf: Math.round(pricePerSF),
      loan_amount: Math.round(loanAmount),
      equity: Math.round(equity),
      annual_debt_service: Math.round(annualDebtService),
      // NOI / cap / YoC / DSCR / cash-on-cash / IRR / equity-multiple / exit
      // intentionally omitted — they depend on NOI which is fabricated.
    };
  }

  return {
    noi: Math.round(noi),
    effective_gross_income: Math.round(effectiveGrossIncome),
    total_expenses: Math.round(totalExpenses),
    going_in_cap_rate: Math.round(goingInCapRate * 10000) / 10000,
    dscr: Math.round(dscr * 100) / 100,
    price_per_unit: Math.round(pricePerUnit),
    price_per_sf: Math.round(pricePerSF),
    cash_on_cash: Math.round(cashOnCash * 10000) / 10000,
    levered_irr: Math.round(irr * 10000) / 10000,
    equity_multiple: Math.round(equityMultiple * 100) / 100,
    annual_debt_service: Math.round(annualDebtService),
    loan_amount: Math.round(loanAmount),
    equity: Math.round(equity),
    total_basis: Math.round(totalBasis),
    cash_flow: Math.round(cashFlow),
    expense_ratio: Math.round(expenseRatio * 10000) / 10000,
    expense_per_unit: Math.round(expensePerUnit),
    yield_on_cost: Math.round(yieldOnCost * 10000) / 10000,
    exit_value: Math.round(exitValue),
    net_proceeds: Math.round(netProceeds),
  };
}

function riskScore(metrics) {
  // Returns { score: 1-10, level: 'low'|'medium'|'high', factors: [] }
  let score = 5;
  const factors = [];

  if (metrics.going_in_cap_rate >= 0.065) { score += 1; factors.push({ type: 'positive', text: 'Strong cap rate' }); }
  else if (metrics.going_in_cap_rate < 0.05) { score -= 1; factors.push({ type: 'negative', text: 'Low cap rate' }); }

  if (metrics.dscr >= 1.4) { score += 1; factors.push({ type: 'positive', text: 'Strong DSCR' }); }
  else if (metrics.dscr < 1.15) { score -= 2; factors.push({ type: 'negative', text: 'Tight DSCR' }); }
  else if (metrics.dscr < 1.25) { score -= 1; factors.push({ type: 'negative', text: 'Below-target DSCR' }); }

  if (metrics.cash_on_cash >= 0.08) { score += 1; factors.push({ type: 'positive', text: 'Good cash yield' }); }
  else if (metrics.cash_on_cash < 0.04) { score -= 1; factors.push({ type: 'negative', text: 'Low cash yield' }); }

  if (metrics.levered_irr >= 0.15) { score += 1; factors.push({ type: 'positive', text: 'Strong IRR' }); }
  else if (metrics.levered_irr < 0.10) { score -= 1; factors.push({ type: 'negative', text: 'Below-target IRR' }); }

  if (metrics.equity_multiple >= 2.0) { score += 1; factors.push({ type: 'positive', text: 'Good equity multiple' }); }

  score = Math.max(1, Math.min(10, score));
  const level = score >= 7 ? 'low' : score >= 4 ? 'medium' : 'high';
  return { score, level, factors };
}

// ────────────────────────────────────────────────────────────────
// Route Handlers
// ────────────────────────────────────────────────────────────────

async function handleGetDeals(request, env) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const state = url.searchParams.get('state');
  const search = url.searchParams.get('search');
  const starred = url.searchParams.get('starred');
  const sortBy = url.searchParams.get('sort') || 'created_at';
  const sortDir = url.searchParams.get('dir') || 'desc';

  let query = 'SELECT * FROM deals WHERE 1=1';
  const params = [];

  if (status) { query += ' AND status = ?'; params.push(status); }
  if (state) { query += ' AND state = ?'; params.push(state); }
  if (starred === '1') { query += ' AND starred = 1'; }
  if (search) {
    query += ' AND (name LIKE ? OR city LIKE ? OR submarket LIKE ? OR state LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  // Validate sort field
  const allowedSorts = ['name', 'created_at', 'updated_at', 'purchase_price', 'units', 'state', 'status'];
  const safeSort = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
  const safeDir = sortDir === 'asc' ? 'ASC' : 'DESC';
  query += ` ORDER BY ${safeSort} ${safeDir}`;

  const result = await env.DB.prepare(query).bind(...params).all();
  const deals = (result.results || []).map(deal => {
    const metrics = calculateMetrics(deal);
    const risk = riskScore(metrics);
    return { ...deal, metrics, risk };
  });

  return jsonResponse({ deals, count: deals.length });
}

async function handleGetDeal(request, env, dealId) {
  const deal = await env.DB.prepare('SELECT * FROM deals WHERE id = ?').bind(dealId).first();
  if (!deal) return errorResponse('Deal not found', 404);

  const metrics = calculateMetrics(deal);
  const risk = riskScore(metrics);

  // Get recent activity for this deal
  const activity = await env.DB.prepare(
    'SELECT * FROM activity_log WHERE deal_id = ? ORDER BY created_at DESC LIMIT 20'
  ).bind(dealId).all();

  return jsonResponse({ ...deal, metrics, risk, activity: activity.results || [] });
}

async function handleCreateDeal(request, env) {
  const user = getUserFromRequest(request);
  const body = await request.json();

  if (!body.name) return errorResponse('Deal name is required');

  // Generate ID from name
  const id = body.id || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // Check for duplicate
  const existing = await env.DB.prepare('SELECT id FROM deals WHERE id = ?').bind(id).first();
  if (existing) return errorResponse('A deal with this ID already exists', 409);

  const fields = [
    'name', 'address', 'city', 'state', 'submarket', 'units', 'total_sf', 'year_built',
    'property_type', 'deal_type', 'status', 'starred',
    'purchase_price', 'closing_costs', 'capex_budget',
    'gross_potential_rent', 'vacancy_rate', 'other_income_per_unit', 'concessions_per_unit',
    'taxes', 'insurance', 'utilities', 'repairs_maintenance', 'management_fee_pct',
    'admin', 'payroll', 'marketing', 'capex_reserve_per_unit', 'total_expenses_override',
    'ltv', 'interest_rate', 'amortization_years', 'io_period_months', 'loan_term_years',
    'exit_cap_rate', 'sale_costs_pct', 'hold_period_years',
    'broker_name', 'broker_company', 'broker_email', 'broker_phone',
    'notes', 'summary', 'risk_factors', 'investment_thesis', 'entitlement_data',
    'date_listed', 'date_cfo', 'date_best_final', 'date_loi_submitted',
    'date_loi_accepted', 'date_dd_start', 'date_dd_end', 'date_closing',
    'unit_mix',
    // Dev-agent step output blobs (JSON). Shape matches deal-state.json
    // sections from fordcwprop/dev-agent. Worker serializes objects to
    // JSON strings at write time; frontend parses them at read time.
    'zoning_data', 'site_data', 'demographics_data', 'provenance_data', 'market_data', 'strategy_screen_data',
    'asking_price', 'asking_price_basis',
    'noi_data', 'dev_cost_data', 'financing_data', 'returns_data', 'strategy_data',
    // Scenarios (multi-model per deal) + narrative fields
    'scenarios_data', 'base_case_summary', 'upside_path', 'sources_data',
    // Hybrid acq+dev phase breakdown (see migrations/004_phase_context.sql)
    'phase_context',
    // GIS portal URL (county parcel viewer), editable from deal header
    'gis_url'
  ];

  const setCols = ['id'];
  const setVals = [id];
  const placeholders = ['?'];

  for (const field of fields) {
    if (body[field] !== undefined) {
      setCols.push(field);
      setVals.push(JSON_BLOB_FIELDS.has(field) ? (typeof body[field] === 'string' ? body[field] : JSON.stringify(body[field])) : body[field]);
      placeholders.push('?');
    }
  }

  setCols.push('created_by');
  setVals.push(user.email);
  placeholders.push('?');

  const sql = `INSERT INTO deals (${setCols.join(', ')}) VALUES (${placeholders.join(', ')})`;
  await env.DB.prepare(sql).bind(...setVals).run();

  // Log activity
  await env.DB.prepare(
    'INSERT INTO activity_log (deal_id, action, details, user_email) VALUES (?, ?, ?, ?)'
  ).bind(id, 'created', JSON.stringify({ name: body.name }), user.email).run();

  // Return the created deal
  const deal = await env.DB.prepare('SELECT * FROM deals WHERE id = ?').bind(id).first();
  const metrics = calculateMetrics(deal);
  const risk = riskScore(metrics);
  return jsonResponse({ ...deal, metrics, risk }, 201);
}

async function handleUpdateDeal(request, env, dealId) {
  const user = getUserFromRequest(request);
  const body = await request.json();

  const deal = await env.DB.prepare('SELECT * FROM deals WHERE id = ?').bind(dealId).first();
  if (!deal) return errorResponse('Deal not found', 404);

  const updatableFields = [
    'name', 'address', 'city', 'state', 'submarket', 'units', 'total_sf', 'year_built',
    'property_type', 'deal_type', 'status', 'starred',
    'purchase_price', 'closing_costs', 'capex_budget',
    'gross_potential_rent', 'vacancy_rate', 'other_income_per_unit', 'concessions_per_unit',
    'taxes', 'insurance', 'utilities', 'repairs_maintenance', 'management_fee_pct',
    'admin', 'payroll', 'marketing', 'capex_reserve_per_unit', 'total_expenses_override',
    'ltv', 'interest_rate', 'amortization_years', 'io_period_months', 'loan_term_years',
    'exit_cap_rate', 'sale_costs_pct', 'hold_period_years',
    'broker_name', 'broker_company', 'broker_email', 'broker_phone',
    'notes', 'summary', 'risk_factors', 'investment_thesis', 'entitlement_data',
    'date_listed', 'date_cfo', 'date_best_final', 'date_loi_submitted',
    'date_loi_accepted', 'date_dd_start', 'date_dd_end', 'date_closing',
    'unit_mix',
    // Dev-agent step output blobs (JSON). Shape matches deal-state.json
    // sections from fordcwprop/dev-agent. Worker serializes objects to
    // JSON strings at write time; frontend parses them at read time.
    'zoning_data', 'site_data', 'demographics_data', 'provenance_data', 'market_data', 'strategy_screen_data',
    'asking_price', 'asking_price_basis',
    'noi_data', 'dev_cost_data', 'financing_data', 'returns_data', 'strategy_data',
    // Scenarios (multi-model per deal) + narrative fields
    'scenarios_data', 'base_case_summary', 'upside_path', 'sources_data',
    // Hybrid acq+dev phase breakdown (see migrations/004_phase_context.sql)
    'phase_context',
    // GIS portal URL (county parcel viewer), editable from deal header
    'gis_url'
  ];

  const sets = [];
  const vals = [];
  const changes = {};

  for (const field of updatableFields) {
    if (body[field] !== undefined) {
      const val = JSON_BLOB_FIELDS.has(field) ? (typeof body[field] === 'string' ? body[field] : JSON.stringify(body[field])) : body[field];
      sets.push(`${field} = ?`);
      vals.push(val);
      if (deal[field] !== val) {
        changes[field] = { from: deal[field], to: val };
      }
    }
  }

  if (sets.length === 0) return errorResponse('No fields to update');

  sets.push('updated_at = CURRENT_TIMESTAMP');
  vals.push(dealId);

  await env.DB.prepare(`UPDATE deals SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();

  // Log activity
  let action = 'updated';
  if (changes.status) action = 'status_changed';
  else if (changes.notes) action = 'note_updated';
  else if (changes.starred !== undefined) action = body.starred ? 'starred' : 'unstarred';

  await env.DB.prepare(
    'INSERT INTO activity_log (deal_id, action, details, user_email) VALUES (?, ?, ?, ?)'
  ).bind(dealId, action, JSON.stringify(changes), user.email).run();

  const updated = await env.DB.prepare('SELECT * FROM deals WHERE id = ?').bind(dealId).first();
  const metrics = calculateMetrics(updated);
  const risk = riskScore(metrics);
  return jsonResponse({ ...updated, metrics, risk });
}

async function handleDeleteDeal(request, env, dealId) {
  const deal = await env.DB.prepare('SELECT id FROM deals WHERE id = ?').bind(dealId).first();
  if (!deal) return errorResponse('Deal not found', 404);

  await env.DB.prepare('DELETE FROM activity_log WHERE deal_id = ?').bind(dealId).run();
  await env.DB.prepare('DELETE FROM deals WHERE id = ?').bind(dealId).run();

  return jsonResponse({ success: true, message: `Deal ${dealId} deleted` });
}

async function handleGetStats(request, env) {
  const total = await env.DB.prepare('SELECT COUNT(*) as count FROM deals').first();
  const byStatus = await env.DB.prepare(
    'SELECT status, COUNT(*) as count FROM deals GROUP BY status ORDER BY count DESC'
  ).all();
  const byState = await env.DB.prepare(
    'SELECT state, COUNT(*) as count FROM deals GROUP BY state ORDER BY count DESC'
  ).all();
  const starred = await env.DB.prepare('SELECT COUNT(*) as count FROM deals WHERE starred = 1').first();

  // Aggregate metrics
  // Exclude killed + dead from aggregate stats (both statuses mean "not pursuing")
  const allDeals = await env.DB.prepare("SELECT * FROM deals WHERE status NOT IN ('killed','dead')").all();
  const metrics = (allDeals.results || []).map(d => calculateMetrics(d)).filter(m => m.noi);

  const avgCapRate = metrics.length ? metrics.reduce((s, m) => s + m.going_in_cap_rate, 0) / metrics.length : 0;
  const avgDscr = metrics.length ? metrics.reduce((s, m) => s + m.dscr, 0) / metrics.length : 0;
  const totalEquity = metrics.reduce((s, m) => s + (m.equity || 0), 0);

  return jsonResponse({
    total: total.count,
    by_status: byStatus.results || [],
    by_state: byState.results || [],
    starred: starred.count,
    avg_cap_rate: Math.round(avgCapRate * 10000) / 10000,
    avg_dscr: Math.round(avgDscr * 100) / 100,
    total_equity_required: totalEquity,
    active_deals: metrics.length,
  });
}

async function handleGetActivity(request, env) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const dealId = url.searchParams.get('deal_id');

  let query = 'SELECT a.*, d.name as deal_name FROM activity_log a LEFT JOIN deals d ON a.deal_id = d.id';
  const params = [];

  if (dealId) {
    query += ' WHERE a.deal_id = ?';
    params.push(dealId);
  }
  query += ' ORDER BY a.created_at DESC LIMIT ?';
  params.push(limit);

  const result = await env.DB.prepare(query).bind(...params).all();
  return jsonResponse({ activity: result.results || [] });
}

async function handleGetMe(request) {
  const user = getUserFromRequest(request);
  return jsonResponse(user);
}

async function handleStatus(request, env) {
  return jsonResponse({ status: 'ok', service: 'CW Pipeline API', version: '1.0.0' });
}

async function handleStressTest(request, env, dealId) {
  const deal = await env.DB.prepare('SELECT * FROM deals WHERE id = ?').bind(dealId).first();
  if (!deal) return errorResponse('Deal not found', 404);

  const baseMetrics = calculateMetrics(deal);
  const scenarios = [];

  // Rate shock scenarios
  const rateShocks = [0, 0.005, 0.01, 0.015, 0.02];
  for (const shock of rateShocks) {
    const stressed = { ...deal, interest_rate: (deal.interest_rate || 0.065) + shock };
    const m = calculateMetrics(stressed);
    scenarios.push({
      name: shock === 0 ? 'Base Case' : `+${(shock * 100).toFixed(1)}% Rate`,
      interest_rate: stressed.interest_rate,
      noi: m.noi,
      dscr: m.dscr,
      cash_on_cash: m.cash_on_cash,
      levered_irr: m.levered_irr,
    });
  }

  // Vacancy shock
  const vacancyScenarios = [];
  const vacShocks = [0, 0.025, 0.05, 0.075, 0.10];
  for (const shock of vacShocks) {
    const stressed = { ...deal, vacancy_rate: (deal.vacancy_rate || 0.05) + shock };
    const m = calculateMetrics(stressed);
    vacancyScenarios.push({
      name: shock === 0 ? 'Base Case' : `+${(shock * 100).toFixed(1)}% Vacancy`,
      vacancy_rate: stressed.vacancy_rate,
      noi: m.noi,
      dscr: m.dscr,
      cash_on_cash: m.cash_on_cash,
    });
  }

  return jsonResponse({ base: baseMetrics, rate_scenarios: scenarios, vacancy_scenarios: vacancyScenarios });
}

async function handleCompareDeals(request, env) {
  const url = new URL(request.url);
  const ids = url.searchParams.get('ids');
  if (!ids) return errorResponse('Provide deal IDs as comma-separated list: ?ids=deal1,deal2,deal3');

  const dealIds = ids.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const deals = [];

  for (const id of dealIds) {
    const deal = await env.DB.prepare('SELECT * FROM deals WHERE id = ?').bind(id).first();
    if (deal) {
      const metrics = calculateMetrics(deal);
      const risk = riskScore(metrics);
      deals.push({ ...deal, metrics, risk });
    }
  }

  return jsonResponse({ deals, count: deals.length });
}

async function handleExportCSV(request, env) {
  const result = await env.DB.prepare('SELECT * FROM deals ORDER BY created_at DESC').all();
  const deals = result.results || [];

  const headers = ['Name', 'City', 'State', 'Units', 'Purchase Price', 'Status',
    'Cap Rate', 'DSCR', 'Price/Unit', 'Cash-on-Cash', 'IRR', 'Equity Multiple'];

  const rows = deals.map(d => {
    const m = calculateMetrics(d);
    return [
      d.name, d.city, d.state, d.units, d.purchase_price, d.status,
      m.going_in_cap_rate ? (m.going_in_cap_rate * 100).toFixed(2) + '%' : '',
      m.dscr ? m.dscr.toFixed(2) + 'x' : '',
      m.price_per_unit ? '$' + m.price_per_unit.toLocaleString() : '',
      m.cash_on_cash ? (m.cash_on_cash * 100).toFixed(2) + '%' : '',
      m.levered_irr ? (m.levered_irr * 100).toFixed(2) + '%' : '',
      m.equity_multiple ? m.equity_multiple.toFixed(2) + 'x' : '',
    ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="pipeline_export.csv"',
      ...getCorsHeaders(),
    },
  });
}

// ────────────────────────────────────────────────────────────────
// Router
// ────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: getCorsHeaders() });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // Status
      if (path === '/' || path === '/api/status') return handleStatus(request, env);

      // Auth
      if (path === '/api/me') return handleGetMe(request);

      // Stats
      if (path === '/api/stats' && method === 'GET') return handleGetStats(request, env);

      // Activity
      if (path === '/api/activity' && method === 'GET') return handleGetActivity(request, env);

      // Compare deals
      if (path === '/api/deals/compare' && method === 'GET') return handleCompareDeals(request, env);

      // Export CSV
      if (path === '/api/deals/export/csv' && method === 'GET') return handleExportCSV(request, env);

      // Deal CRUD
      if (path === '/api/deals' && method === 'GET') return handleGetDeals(request, env);
      if (path === '/api/deals' && method === 'POST') return handleCreateDeal(request, env);

      // Individual deal routes
      const dealMatch = path.match(/^\/api\/deals\/([^/]+)$/);
      if (dealMatch) {
        const dealId = dealMatch[1];
        if (method === 'GET') return handleGetDeal(request, env, dealId);
        if (method === 'PATCH' || method === 'PUT') return handleUpdateDeal(request, env, dealId);
        if (method === 'DELETE') return handleDeleteDeal(request, env, dealId);
      }

      // Stress test
      const stressMatch = path.match(/^\/api\/deals\/([^/]+)\/stress$/);
      if (stressMatch && method === 'GET') return handleStressTest(request, env, stressMatch[1]);

      return errorResponse('Not found', 404);
    } catch (err) {
      console.error('API Error:', err);
      return errorResponse(`Internal server error: ${err.message}`, 500);
    }
  },
};
