ALTER TABLE "Table"
  ADD COLUMN IF NOT EXISTS "zone" TEXT NOT NULL DEFAULT 'Salon',
  ADD COLUMN IF NOT EXISTS "layoutX" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS "layoutY" INTEGER NOT NULL DEFAULT 50;

WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY name ASC) - 1 AS rn
  FROM "Table"
)
UPDATE "Table" t
SET
  "layoutX" = LEAST(90, 12 + ((ordered.rn % 4) * 24)),
  "layoutY" = LEAST(90, 12 + ((ordered.rn / 4) * 22)),
  "zone" = COALESCE(NULLIF(t."zone", ''), 'Salon')
FROM ordered
WHERE t.id = ordered.id;
