CREATE INDEX "Task_full_text_search_idx"
ON "Task"
USING GIN (
  to_tsvector('english', coalesce("title", '') || ' ' || coalesce("description", ''))
);
