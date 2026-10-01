-- Migration: 003_create_prerequisites.sql
-- Description: Create prerequisites table representing directed dependency edges in the Curriculum DAG
-- Edge semantics: course_id REQUIRES prereq_course_id (prereq_course_id -> course_id)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS prerequisites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    prereq_course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    grade_requirement VARCHAR(5) DEFAULT 'C',
    is_corequisite BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_course_prereq UNIQUE (course_id, prereq_course_id),
    CONSTRAINT chk_no_self_prereq CHECK (course_id <> prereq_course_id)
);

CREATE INDEX IF NOT EXISTS idx_prerequisites_course_id ON prerequisites(course_id);
CREATE INDEX IF NOT EXISTS idx_prerequisites_prereq_id ON prerequisites(prereq_course_id);
