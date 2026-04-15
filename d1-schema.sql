-- Pipeline D1 Schema - CW Properties Deal Pipeline
-- Cloudflare D1 Compatible

-- Deals table - core deal record with all underwriting inputs
CREATE TABLE IF NOT EXISTS deals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    submarket TEXT,
    units INTEGER,
    total_sf REAL,
    year_built INTEGER,
    property_type TEXT DEFAULT 'garden',
    deal_type TEXT DEFAULT 'acquisition',
    status TEXT DEFAULT 'sourced',
    starred INTEGER DEFAULT 0,

    -- Acquisition
    purchase_price REAL,
    closing_costs REAL,
    capex_budget REAL,

    -- Revenue
    gross_potential_rent REAL,
    vacancy_rate REAL DEFAULT 0.05,
    other_income_per_unit REAL DEFAULT 0,
    concessions_per_unit REAL DEFAULT 0,

    -- Expenses
    taxes REAL DEFAULT 0,
    insurance REAL DEFAULT 0,
    utilities REAL DEFAULT 0,
    repairs_maintenance REAL DEFAULT 0,
    management_fee_pct REAL DEFAULT 0.03,
    admin REAL DEFAULT 0,
    payroll REAL DEFAULT 0,
    marketing REAL DEFAULT 0,
    capex_reserve_per_unit REAL DEFAULT 250,
    total_expenses_override REAL,

    -- Financing
    ltv REAL DEFAULT 0.65,
    interest_rate REAL DEFAULT 0.065,
    amortization_years INTEGER DEFAULT 30,
    io_period_months INTEGER DEFAULT 0,
    loan_term_years INTEGER DEFAULT 10,

    -- Exit
    exit_cap_rate REAL DEFAULT 0.055,
    sale_costs_pct REAL DEFAULT 0.02,
    hold_period_years INTEGER DEFAULT 5,

    -- Broker
    broker_name TEXT,
    broker_company TEXT,
    broker_email TEXT,
    broker_phone TEXT,

    -- Notes & analysis
    notes TEXT,
    summary TEXT,
    risk_factors TEXT,
    investment_thesis TEXT,

    -- Entitlement data (JSON blob)
    entitlement_data TEXT,

    -- Dev-agent step outputs (JSON blobs, one per underwriting step)
    -- Shape of each blob matches the corresponding deal-state.json section
    -- in the fordcwprop/dev-agent repo. See Dev Agent/system/architecture.md.
    zoning_data TEXT,          -- step_1_zoning (the broader zoning output; entitlement_data is the case-history subset)
    site_data TEXT,            -- step_2_site
    market_data TEXT,          -- step_3_market
    strategy_screen_data TEXT, -- step_3_5_strategy_screen
    noi_data TEXT,             -- step_5_noi
    dev_cost_data TEXT,        -- step_6_dev_costs
    financing_data TEXT,       -- step_7_financing
    returns_data TEXT,         -- step_8_returns
    strategy_data TEXT,        -- step_9_strategy

    -- Multi-scenario underwriting. scenarios_data is a JSON array of every
    -- scenario modeled for this deal; each scenario carries its own
    -- step_4..step_9 snapshot + metadata. The "primary" scenario's step
    -- outputs are mirrored to the scalar columns above so calculateMetrics
    -- reflects the current best case. base_case_summary and upside_path
    -- are free-form markdown narrative.
    scenarios_data TEXT,
    base_case_summary TEXT,
    upside_path TEXT,
    sources_data TEXT,  -- JSON array of {id, label, url, note} primary sources
                        -- referenced from narrative text via [^sourceid] markers

    -- Key dates
    date_listed TEXT,
    date_cfo TEXT,
    date_best_final TEXT,
    date_loi_submitted TEXT,
    date_loi_accepted TEXT,
    date_dd_start TEXT,
    date_dd_end TEXT,
    date_closing TEXT,

    -- Unit mix JSON (array of {type, count, avg_sf, avg_rent})
    unit_mix TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
);

-- Activity log
CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deal_id TEXT,
    action TEXT NOT NULL,
    details TEXT,
    user_email TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deal_id) REFERENCES deals(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_state ON deals(state);
CREATE INDEX IF NOT EXISTS idx_deals_starred ON deals(starred);
CREATE INDEX IF NOT EXISTS idx_deals_created ON deals(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_deal ON activity_log(deal_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);
