-- Migration 003: Add sources_data column
--
-- JSON array of primary sources referenced from narrative text. Each entry:
--   { id: "zoning-ord", label: "Shelby County Zoning Ordinance Sec. 5.4",
--     url: "https://...", note: "R-4 min lot size = 3,000 SF/unit" }
-- Narrative fields (base_case_summary, upside_path, scenario step_9 text)
-- reference sources inline via [^id] markers that the UI resolves to
-- hover-popover links.
--
-- Apply with:
--   npx wrangler d1 execute pipeline-production --file=migrations/003_sources.sql --remote

ALTER TABLE deals ADD COLUMN sources_data TEXT;
