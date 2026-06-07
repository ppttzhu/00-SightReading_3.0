-- Shuffle the "options" array inside the content JSONB column of quizzes.
-- Only targets rows where options exists and is a valid JSON array.
UPDATE quizzes
SET content = jsonb_set(
  content,
  '{options}',
  (
    SELECT jsonb_agg(elem)
    FROM (
      SELECT elem
      FROM jsonb_array_elements(content->'options') AS elem
      ORDER BY random()
    ) sub
  )
)
WHERE content ? 'options'
  AND jsonb_typeof(content->'options') = 'array';
