-- Migration 006: Add asking_price + provenance_data columns
--
-- asking_price: the seller / broker's asking number at deal intake, distinct
-- from purchase_price (which for development deals is TDC, and for acquisitions
-- is the negotiated price we may eventually pay). Null means "no asking price
-- provided" — the UI will display that explicitly so Jack can see at a glance
-- whether a deal even has a public number.
--
-- provenance_data: JSON blob populated by the `deal-provenance` sub-skill.
-- Holds broker contact info + key dates (listing / OM received / CFO /
-- best-and-final / LOI) + evidence snippets from email search. Schema
-- versioned as "provenance.v1". Rendered by a new deal-header panel.
--
-- Apply with:
--   npx wrangler d1 execute pipeline-production --file=migrations/006_provenance.sql --remote

ALTER TABLE deals ADD COLUMN asking_price REAL;
ALTER TABLE deals ADD COLUMN asking_price_basis TEXT;
ALTER TABLE deals ADD COLUMN provenance_data TEXT;
