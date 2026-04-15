-- Migration 002: Add scenario tracking columns
--
-- Adds three columns to support multi-scenario underwriting per deal:
--   scenarios_data     — JSON array of every scenario modeled for this deal.
--                        Each scenario contains the step_4..step_9 snapshot
--                        plus a name/summary/primary flag. The "primary"
--                        scenario's step outputs are mirrored to the flat
--                        scalar columns so calculateMetrics reflects the
--                        best case.
--   base_case_summary  — Free-form markdown describing the zoning / at-plan
--                        base state (what the site is, what it allows,
--                        what a by-right program looks like).
--   upside_path        — Free-form markdown describing the path from base
--                        case to the primary (winning) scenario — what
--                        moves (density, product mix, rent, cost) and
--                        what has to be true for it to work.
--
-- Apply with:
--   npx wrangler d1 execute pipeline-production --file=migrations/002_scenarios.sql --remote

ALTER TABLE deals ADD COLUMN scenarios_data TEXT;
ALTER TABLE deals ADD COLUMN base_case_summary TEXT;
ALTER TABLE deals ADD COLUMN upside_path TEXT;
