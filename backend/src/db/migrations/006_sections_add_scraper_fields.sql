-- Migration: 006_sections_add_scraper_fields.sql
-- Description: Add course_code (denormalized lookup) and seats_available (integer)
--              to support scraper ingestion and the normalized shape expected by
--              seatSyncService without a JOIN to courses on every read.
--
-- Design notes:
--   • course_code is denormalized intentionally so the scraper row can be stored
--     even before a matching courses.id is resolved; the FK course_id is still
--     the authoritative link.
--   • seats_available is a plain INT (NOT a generated/computed column) so the
--     sync loop can write it directly from the scraped value.  A CHECK constraint
--     prevents negatives.

BEGIN;

-- 1. Add course_code for direct lookup (scraped value; NOT NULL only after backfill)
ALTER TABLE sections
  ADD COLUMN IF NOT EXISTS course_code VARCHAR(20);

-- Backfill from courses for rows that already exist
UPDATE sections s
SET    course_code = c.code
FROM   courses c
WHERE  s.course_id = c.id
AND    s.course_code IS NULL;

-- Index to speed up scraper UPSERT keyed by code + term + section_number
CREATE INDEX IF NOT EXISTS idx_sections_course_code_term
  ON sections(course_code, term, section_number);

-- 2. Add seats_available column (integer, ≥ 0)
ALTER TABLE sections
  ADD COLUMN IF NOT EXISTS seats_available INT NOT NULL DEFAULT 0
  CHECK (seats_available >= 0);

-- Backfill: derive from existing capacity - enrolled_count for historical rows
UPDATE sections
SET    seats_available = GREATEST(0, capacity - enrolled_count)
WHERE  seats_available = 0 AND capacity > 0;

COMMIT;
