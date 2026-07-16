-- Strategy-first funnel: the first-pass ranking + Jack's steering pick, synced
-- as a JSON object { strategies:[{strategy_id, yoc_pct, dev_spread_bps, thesis,
-- kill_recommendation}], viable:[...], selected:[...], auto, awaiting_selection }.
-- Rendered by the StrategyFirstPassCard so Jack compares the in-play strategies
-- and greenlights which go into a full deep underwrite.
ALTER TABLE deals ADD COLUMN first_pass_data TEXT;
