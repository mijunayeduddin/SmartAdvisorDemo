-- SmartAdvisor Sections Table Schema
CREATE TABLE IF NOT EXISTS sections (
    id SERIAL PRIMARY KEY,
    course TEXT NOT NULL,
    department TEXT NOT NULL,
    section INT NOT NULL,
    faculty TEXT NOT NULL,
    time_raw TEXT NOT NULL,
    days TEXT NOT NULL DEFAULT '',
    start_time TIME NULL,
    end_time TIME NULL,
    room TEXT NOT NULL,
    seats INT NOT NULL DEFAULT 0,
    semester TEXT NULL,
    prediction TEXT NULL,
    records TEXT NULL,
    CONSTRAINT unique_course_section_time_room UNIQUE (course, section, time_raw, room)
);

-- Performance Indexes for Sections
CREATE INDEX IF NOT EXISTS idx_sections_course ON sections(course);
CREATE INDEX IF NOT EXISTS idx_sections_department ON sections(department);
CREATE INDEX IF NOT EXISTS idx_sections_faculty ON sections(faculty);
CREATE INDEX IF NOT EXISTS idx_sections_seats ON sections(seats);
CREATE INDEX IF NOT EXISTS idx_sections_days ON sections(days);

-- Curriculum Courses Table Schema (Multi-program: CSE & BBA)
CREATE TABLE IF NOT EXISTS curriculum_courses (
    program TEXT NOT NULL DEFAULT 'CSE',
    code TEXT NOT NULL,
    aliases TEXT[] NOT NULL DEFAULT '{}',
    name TEXT NOT NULL,
    credits NUMERIC NOT NULL,
    grp TEXT NOT NULL,
    min_credits INT NOT NULL DEFAULT 0,
    has_alternative BOOL NOT NULL DEFAULT FALSE,
    raw_prereq TEXT,
    unknown_prereqs TEXT[] NOT NULL DEFAULT '{}',
    waivable BOOL NOT NULL DEFAULT FALSE,
    elective_pool TEXT NULL,
    note TEXT NULL,
    coreq_codes TEXT[] NOT NULL DEFAULT '{}',
    has_waiver_option BOOL NOT NULL DEFAULT FALSE,
    special TEXT NULL,
    PRIMARY KEY (program, code)
);

-- Curriculum Prerequisites Table Schema
-- One row per alternative; a course is satisfied when, for EVERY group_no, at least one alt_code is completed or waived
CREATE TABLE IF NOT EXISTS curriculum_prereqs (
    id SERIAL PRIMARY KEY,
    program TEXT NOT NULL DEFAULT 'CSE',
    course_code TEXT NOT NULL,
    group_no INT NOT NULL,
    alt_code TEXT NOT NULL
);

-- Curriculum Course Majors Table Schema
-- Associates course memberships with majors (e.g. HRM370: HRM elective + MGT core)
CREATE TABLE IF NOT EXISTS curriculum_course_majors (
    program TEXT NOT NULL,
    code TEXT NOT NULL,
    major TEXT NOT NULL,
    kind TEXT NOT NULL,
    PRIMARY KEY (program, code, major, kind)
);

-- Performance Indexes for Curriculum
CREATE INDEX IF NOT EXISTS idx_curriculum_courses_program_grp ON curriculum_courses(program, grp);
CREATE INDEX IF NOT EXISTS idx_curriculum_prereqs_prog_course ON curriculum_prereqs(program, course_code);
CREATE INDEX IF NOT EXISTS idx_curriculum_majors_prog_major ON curriculum_course_majors(program, major);
