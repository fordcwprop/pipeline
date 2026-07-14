-- Deal documents: the human-readable .md files from the deal folder
-- (deal-memo.md, questions-for-jack.md, status.md), synced as a JSON object
-- { "<filename>": "<markdown>" } so Jack can read them on the deal page
-- instead of digging through GitHub. Rendered by the DocumentsCard.
ALTER TABLE deals ADD COLUMN deal_documents TEXT;
