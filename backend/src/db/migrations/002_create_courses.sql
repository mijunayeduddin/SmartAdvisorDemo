-- Migration: 002_create_courses.sql
-- Description: Create courses table representing vertices in the Curriculum DAG

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    credits NUMERIC(3, 1) NOT NULL DEFAULT 3.0,
    department VARCHAR(100) NOT NULL DEFAULT 'CSE',
    description TEXT,
    is_milestone BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(code);
CREATE INDEX IF NOT EXISTS idx_courses_milestone ON courses(is_milestone);
