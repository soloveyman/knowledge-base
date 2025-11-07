-- Backfill businessId for existing records
-- This script should be run after adding business_id columns

-- Update documents: set businessId from uploadedBy user's businessId
UPDATE documents d
SET business_id = u.business_id
FROM users u
WHERE d.uploaded_by = u.id
  AND d.business_id IS NULL
  AND u.business_id IS NOT NULL;

-- Update tests: set businessId from createdBy user's businessId
UPDATE tests t
SET business_id = u.business_id
FROM users u
WHERE t.created_by = u.id
  AND t.business_id IS NULL
  AND u.business_id IS NOT NULL;

-- Update questions: set businessId from createdBy user's businessId
UPDATE questions q
SET business_id = u.business_id
FROM users u
WHERE q.created_by = u.id
  AND q.business_id IS NULL
  AND u.business_id IS NOT NULL;

-- Update modules: set businessId from createdBy user's businessId
UPDATE modules m
SET business_id = u.business_id
FROM users u
WHERE m.created_by = u.id
  AND m.business_id IS NULL
  AND u.business_id IS NOT NULL;

-- Update assignments: set businessId from assignedBy user's businessId
UPDATE assignments a
SET business_id = u.business_id
FROM users u
WHERE a.assigned_by = u.id
  AND a.business_id IS NULL
  AND u.business_id IS NOT NULL;

-- For records where businessId is still NULL, set it to the user's own ID (owner's businessId = their own ID)
UPDATE documents d
SET business_id = d.uploaded_by
WHERE d.business_id IS NULL;

UPDATE tests t
SET business_id = t.created_by
WHERE t.business_id IS NULL;

UPDATE questions q
SET business_id = q.created_by
WHERE q.business_id IS NULL;

UPDATE modules m
SET business_id = m.created_by
WHERE m.business_id IS NULL;

UPDATE assignments a
SET business_id = a.assigned_by
WHERE a.business_id IS NULL;

