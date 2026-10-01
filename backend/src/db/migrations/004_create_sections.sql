-- Migration: 004_create_sections.sql
-- Description: Create sections table for course offerings with scheduling and capacity limits

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    section_number INT NOT NULL,
    capacity INT NOT NULL CHECK (capacity > 0),
    enrolled_count INT NOT NULL DEFAULT 0 CHECK (enrolled_count >= 0 AND enrolled_count <= capacity),
    room VARCHAR(50),
    day_of_week VARCHAR(10) NOT NULL, -- e.g. 'ST' (Sun/Tue), 'MW' (Mon/Wed), 'RA' (Thu/Sat)
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    faculty_name VARCHAR(255),
    term VARCHAR(50) NOT NULL, -- e.g. 'Fall 2026'
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_course_term_section UNIQUE (course_id, term, section_number),
    CONSTRAINT chk_valid_time_window CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_sections_course_term ON sections(course_id, term);
CREATE INDEX IF NOT EXISTS idx_sections_schedule ON sections(day_of_week, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_sections_capacity ON sections(enrolled_count, capacity);
