-- Migration: 005_create_enrollments.sql
-- Description: Create enrollments table for student registrations and academic history

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'enrolled' 
        CHECK (status IN ('enrolled', 'waitlisted', 'completed', 'dropped')),
    grade VARCHAR(5), -- e.g. 'A', 'B+', 'C', NULL if in progress
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_student_section UNIQUE (student_id, section_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_section_id ON enrollments(section_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);
