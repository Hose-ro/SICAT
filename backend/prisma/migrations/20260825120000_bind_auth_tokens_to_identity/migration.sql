ALTER TABLE "AuthToken"
  ADD COLUMN "targetHash" TEXT;

-- Legacy links cannot prove which address originally received them.
UPDATE "AuthToken"
SET "usedAt" = CURRENT_TIMESTAMP
WHERE "usedAt" IS NULL;
