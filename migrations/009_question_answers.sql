-- 009_question_answers.sql
-- Adds the `question_answers` table so Jack can answer questions surfaced in
-- the pipeline UI and have them flow back into the next underwriting iteration.
--
-- Questions themselves are derived client-side from each step's _contract
-- blob and are not stored as first-class rows. Answers, however, must be
-- addressable and persistent — they outlive any specific run of a sub-skill
-- and need to be retrievable when the orchestrator resumes a deal hours or
-- days later.
--
-- Identity model: each question carries a stable `id` string emitted by the
-- sub-skill (kebab-slug, e.g. "step_5-confirm-trended-rent-growth"). If a
-- question lacks an id (legacy questions written before this migration), the
-- frontend computes a deterministic fingerprint from `${step}|${text}` so an
-- answer can still be persisted — at the cost of orphaning if the text is
-- later rephrased. New sub-skill code MUST emit `id`.

CREATE TABLE IF NOT EXISTS question_answers (
  deal_id        TEXT NOT NULL,
  question_id    TEXT NOT NULL,
  step           TEXT,                       -- denormalized for filtering, e.g. 'step_5'
  question_text  TEXT,                       -- snapshot of the question as it was when answered
  answer_text    TEXT,                       -- Jack's free-text response (nullable)
  selected_choice TEXT,                      -- chosen option when q.choices was populated (nullable)
  answered_by    TEXT NOT NULL,              -- user email from Cf-Access header
  answered_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (deal_id, question_id),
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_question_answers_deal_id ON question_answers(deal_id);
CREATE INDEX IF NOT EXISTS idx_question_answers_updated_at ON question_answers(updated_at);
