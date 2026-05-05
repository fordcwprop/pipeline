-- 008_questions_for_jack.sql
-- Adds the questions_for_jack TEXT column to the deals table.
-- Stores a JSON array of {question, blocks_downstream, answered, context, ...}
-- objects sourced from each skill's _contract.questions_for_jack output.
-- The frontend QuestionsForJack panel renders these at the top of every deal page.
--
-- NOTE: the column was previously added live via a manual ALTER TABLE on
-- pipeline-production D1 (2026-05-04 in the pre-rename pipeline-old-2026-05-05
-- repo). This migration formalizes the schema change so future fresh databases
-- get the column on init. Running this migration on production is a no-op
-- since the column already exists.

ALTER TABLE deals ADD COLUMN questions_for_jack TEXT;
