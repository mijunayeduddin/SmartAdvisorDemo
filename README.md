# SmartAdvisor – Course Finder & Multi-Program Curriculum Tracker

**Course:** CSE 327 Software Engineering | **Institution:** North South University (NSU)

> SmartAdvisor is a fast, responsive, and accessible **course section search** and **curriculum progress tracking** platform built specifically for NSU students across CSE, BBA, and BS in Microbiology programs.

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [Features](#-features)
3. [System Architecture](#️-system-architecture)
4. [Project Structure](#-project-structure)
5. [Technology Stack](#️-technology-stack)
6. [Database & Data Model](#-database--data-model)
7. [API Endpoints](#-api-endpoints)
8. [Environment Configuration](#-environment-configuration)
9. [Running the Application](#-running-the-application)
10. [Automated Testing](#-automated-testing)
11. [Manual Testing](#-manual-testing)
12. [Acceptance Checks & Results](#-acceptance-checks--results)
13. [Roadmap](#-roadmap-future-scope)

---

## 🎯 Project Overview

SmartAdvisor was developed in three phases:

| Phase | Name | Summary |
|---|---|---|
| **Phase 1** | Course Finder | Real-time course section search, multi-field filtering, availability tracking, sorting, and Redis caching. |
| **Phase 2** | CSE My Curriculum Tracker | Degree progress tracker with interactive course completion ticking, instant prerequisite eligibility evaluation, progress meters, and section discovery links. |
| **Phase 3** | Multi-Program Degree Trackers | Multi-program degree tracking across **CSE** (138 cr), **BBA** (130 cr), and **BS in Microbiology (MIC)** (120 cr) with waivable course support, co-requisite handling, live prerequisite/eligibility tracking, and program-independent persistent progress saving. |

---

## ✨ Features

### 🔍 Course Section Finder (Phase 1)
- **Full-text search** across course code, faculty name, department, days, and time
- **Multi-word search** – every word must match (AND logic, case-insensitive)
- **Day-keyword search** – searching "monday" returns sections with `M` in their days field
- **Department filter** – filter sections by department code (e.g., `dept=ACT`)
- **Open seats filter** – `openOnly=true` returns only sections with available seats
- **Eligible-only filter** – `eligibleOnly=true` shows only courses the student can currently enroll in
- **Sorting** – sort by `course`, `section`, `faculty`, `time`, `room`, or `seats`
- **Pagination** – client-side controlled page size and offset
- **Redis caching** – 60-second TTL on section queries; non-blocking fallback when Redis is offline
- **Rate limiting** – 500 requests per 15-minute window via `express-rate-limit`
- **3,814 total sections** across **735 unique courses** from the NSU course catalogue

### 🎓 Curriculum Tracker (Phase 2 & 3)
- **Multi-program support** – CSE (88 courses, 138 cr), BBA (124 courses, 130 cr), MIC (120 cr)
- **Interactive course completion** – click to tick/untick courses; progress saves per program in `localStorage`
- **Live prerequisite eligibility** – real-time `available` / `locked` / `maybe` status per course
- **Waiver support** – `ENG102` and `BUS112` can be waived; satisfies dependents without adding credits
- **Co-requisite handling** – lab co-requisites (e.g., `BIO103L`) never block course eligibility
- **Credit threshold rules** – `MGT489` locks until 100 credits are completed
- **Progress meters** – visual completion bar and credit counters per program
- **Major filter (BBA)** – filter courses by BBA major (FIN, ACT, MKT, HRM, MGT, MIS, INB, SCM, ECO)
- **Major progress tracking** – shows core and elective completion per selected BBA major
- **Section discovery links** – every curriculum course links back to its live section listing
- **Persistent state** – progress stored independently per program (`cf_done_CSE`, `cf_done_BBA`, `cf_done_MIC`, `cf_waived_CSE`, `cf_waived_BBA`, `cf_waived_MIC`); auto-migrates legacy `cf_done` key to CSE
- **Clamping guarantees** – remaining credits never go negative; progress % capped at 100%; "Credit requirement met" shown in green when complete

### 🛡️ Resilience & Reliability
- **Redis fallback** – all endpoints remain fully functional when Redis is offline; falls back to PostgreSQL directly
- **pg-mem in-memory DB for tests** – no live database required to run the test suite
- **Health check endpoint** – `/api/health` reports status of API, PostgreSQL, and Redis independently
- **Idempotent seeding** – `seed.js` safely re-runs without duplicating data (upsert strategy)
- **Cycle detection** – DFS-based prerequisite cycle detector runs at seed time; throws a clear error on circular dependencies

---

## 🏛️ System Architecture

```
        +--------------------------------+
        |     Browser / Mobile Client    |
        +----------------+---------------+
                         |  HTTP :80
                         v
              +---------------------+
              |  NGINX Reverse Proxy |
              +------+--------------+
                     |               |
              / (web)|           /api|
                     v               v
            +--------------+  +------------------+
            |  Next.js 14  |  |  Express REST API |
            |  (React 18)  |  |  (Node.js)        |
            +--------------+  +--------+----------+
                                       |        |
                          (Cache 60s)  |        |  (Source of Truth)
                                       v        v
                                  +---------+  +------------+
                                  |  Redis  |  | PostgreSQL |
                                  |   7     |  |    16      |
                                  +---------+  +------------+
```

### Design Principles
- **Strict separation of concerns** – routes handle HTTP, services hold business logic, DB layer manages persistence
- **Single source of truth** – graduation credit requirements defined once in `config/programs.js`; UI consumes them dynamically from `/api/curriculum/programs`
- **Zero hard-coding in the UI** – all program configs, required credits, and course data come from the API
- **Non-blocking cache** – Redis failures are caught silently; the app continues with database queries

---

## 📁 Project Structure

```
SmartAdvisorTestOwn/
├── apps/
│   ├── api/                            # Express REST API
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── app.js                  # Express app factory
│   │       ├── server.js               # HTTP server entry point
│   │       ├── config/
│   │       │   └── programs.js         # PROGRAMS_CONFIG – graduation credit requirements (single source of truth)
│   │       ├── routes/
│   │       │   ├── sections.js         # GET /api/sections – search, filter, sort, eligibleOnly
│   │       │   ├── curriculum.js       # GET /api/curriculum, /programs | POST /api/curriculum/status
│   │       │   ├── meta.js             # GET /api/meta – section & course counts, departments
│   │       │   └── health.js           # GET /api/health – postgres + redis diagnostics
│   │       ├── services/
│   │       │   ├── sectionService.js       # Query builder, Redis cache orchestration, eligibleOnly logic
│   │       │   ├── curriculumService.js    # Prerequisite eligibility, waiver/credit tracking, major progress
│   │       │   ├── curriculumParser.js     # Generic CSV parser (CSE & BBA), alias resolution, cycle detection
│   │       │   ├── metaService.js          # Aggregations for departments, totalSections, totalCourses
│   │       │   └── healthService.js        # PostgreSQL and Redis ping diagnostics
│   │       ├── db/
│   │       │   ├── schema.sql          # 4 tables: sections, curriculum_courses, curriculum_prereqs, curriculum_course_majors
│   │       │   ├── seed.js             # Idempotent CSV + JSON seeder
│   │       │   └── pool.js             # pg Pool manager with pg-mem fallback for tests
│   │       ├── cache/
│   │       │   └── redisClient.js      # Resilient Redis client with connection timeouts and auto-fallback
│   │       └── tests/
│   │           ├── setupTestDb.js              # pg-mem setup/teardown helpers
│   │           ├── sections.test.js            # Search, filter, sort, validation tests
│   │           ├── curriculumApi.test.js        # Curriculum GET endpoint tests
│   │           ├── curriculumParser.test.js     # Unit tests for parser functions
│   │           ├── curriculumStatus.test.js     # POST /status eligibility logic tests
│   │           ├── degreeCredits.test.js        # Graduation credit requirement tests
│   │           ├── metaAndHealth.test.js        # Meta, health, and Redis resilience tests
│   │           └── bbaCurriculum.test.js        # Phase 3 BBA multi-program acceptance checks
│   │
│   └── web/                            # Next.js 14 Web Client
│       ├── Dockerfile
│       ├── next.config.js
│       └── src/app/
│           ├── layout.js               # Root layout with metadata
│           ├── globals.css             # Vanilla CSS design system (light/dark mode, tokens, animations)
│           └── page.js                 # Main SPA: Course Finder + Curriculum Tracker tabs
│
├── data/
│   ├── response.json                   # NSU section data (3,814 sections, 735 courses)
│   ├── CSE_nsu_courses.csv             # CSE curriculum (88 courses, 238 catalog credits)
│   ├── BBA_nsu_courses.csv             # BBA curriculum (124 courses, 361 catalog credits)
│   └── MIC_nsu_courses.csv             # MIC curriculum (BS Microbiology)
│
├── nginx/
│   └── nginx.conf                      # Reverse proxy config (port 80 → web :3000, /api → api :5000)
│
├── docker-compose.yml                  # 5-service orchestration: postgres, redis, api, web, nginx
├── .env.example                        # Environment variable template
└── README.md
```

---

## 🛠️ Technology Stack

| Layer | Technology | Version | Details |
|---|---|---|---|
| **Web Client** | React | 18 | Component-based UI, hooks for state management |
| **Web Framework** | Next.js | 14 (App Router) | SSR + CSR, `NEXT_PUBLIC_API_URL` for runtime config |
| **Styling** | Vanilla CSS | — | Custom design system, zero external UI libraries, light/dark mode |
| **Backend API** | Node.js + Express.js | LTS | Versioned endpoints, parameterized SQL, defensive input validation |
| **Rate Limiting** | express-rate-limit | ^7 | 500 req / 15 min window |
| **Database** | PostgreSQL | 16 | Primary source of truth, composite PKs, indexed fields, idempotent upserts |
| **Cache** | Redis | 7 | 60s TTL for sections; 10min TTL for curriculum per program; non-blocking fallback |
| **Reverse Proxy** | NGINX | alpine | Routes `/` → Next.js `:3000`; `/api` → Express `:5000` |
| **Containerization** | Docker + Docker Compose | — | 5 services with health checks and dependency ordering |
| **Testing** | Jest + Supertest | 29 / 6 | 74 automated tests across 7 suites |
| **Test DB** | pg-mem | ^3 | In-memory PostgreSQL for tests; no live DB required |

---

## 📦 Database & Data Model

### 1. `sections` Table
Stores all NSU course section data (3,814 sections from `response.json`).

```sql
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

CREATE INDEX idx_sections_course ON sections(course);
CREATE INDEX idx_sections_department ON sections(department);
CREATE INDEX idx_sections_faculty ON sections(faculty);
CREATE INDEX idx_sections_seats ON sections(seats);
CREATE INDEX idx_sections_days ON sections(days);
```

### 2. `curriculum_courses` Table (Multi-Program)
Stores degree requirements for each academic program.

```sql
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

CREATE INDEX idx_curriculum_courses_program_grp ON curriculum_courses(program, grp);
```

### 3. `curriculum_prereqs` Table
Stores prerequisite groups (OR groups within AND logic).

```sql
CREATE TABLE IF NOT EXISTS curriculum_prereqs (
    id SERIAL PRIMARY KEY,
    program TEXT NOT NULL DEFAULT 'CSE',
    course_code TEXT NOT NULL,
    group_no INT NOT NULL,
    alt_code TEXT NOT NULL
);

CREATE INDEX idx_curriculum_prereqs_prog_course ON curriculum_prereqs(program, course_code);
```

### 4. `curriculum_course_majors` Table
Tracks which BBA major(s) each course belongs to (supports dual-major courses like `HRM370`, `MKT382`).

```sql
CREATE TABLE IF NOT EXISTS curriculum_course_majors (
    program TEXT NOT NULL,
    code TEXT NOT NULL,
    major TEXT NOT NULL,
    kind TEXT NOT NULL,
    PRIMARY KEY (program, code, major, kind)
);

CREATE INDEX idx_curriculum_majors_prog_major ON curriculum_course_majors(program, major);
```

---

## 🔌 API Endpoints

### `GET /api/sections`
Search and filter NSU course sections.

| Query Parameter | Type | Description |
|---|---|---|
| `q` | string | Full-text search across course, faculty, room, time; day-name keywords (e.g., `monday`) map to day codes |
| `dept` | string | Exact department code filter (e.g., `CSE`, `ACT`) |
| `day` | string | Single-letter day filter: `S`, `M`, `T`, `W`, `R`, `F`, `A` |
| `faculty` | string | Partial faculty name filter (case-insensitive) |
| `openOnly` | boolean | `true` returns only sections with `seats > 0` |
| `eligibleOnly` | boolean | `true` filters to courses the student is eligible for |
| `program` | string | `CSE`, `BBA`, or `MIC` (used with `eligibleOnly`) |
| `completed` | string | Comma-separated completed course codes |
| `waived` | string | Comma-separated waived course codes |
| `sort` | string | Sort field: `course`, `section`, `faculty`, `time`, `room`, `seats` |
| `order` | string | `asc` or `desc` |
| `page` | number | Page number (default: 1) |
| `limit` | number | Page size, 1–200 (default: 50) |

**Example Response:**
```json
{
  "total": 35,
  "items": [
    {
      "course": "ACT201",
      "department": "ACT",
      "section": 1,
      "faculty": "ARM",
      "days": "MW",
      "start_time": "08:00",
      "end_time": "09:30",
      "seats": 5
    }
  ]
}
```

---

### `GET /api/curriculum/programs`
Returns all available degree programs with credit information.

```json
[
  { "id": "CSE", "courses": 88, "requiredCredits": 138, "catalogCredits": 238 },
  { "id": "BBA", "courses": 124, "requiredCredits": 130, "catalogCredits": 361 },
  { "id": "MIC", "courses": 50, "requiredCredits": 120, "catalogCredits": 120 }
]
```

---

### `GET /api/curriculum?program=CSE|BBA|MIC`
Returns all courses grouped by curriculum group for the specified program (default: `CSE`).
Includes credits, prerequisites, co-requisites, waivable flags, elective pools, notes, major memberships, and live section counts.

---

### `POST /api/curriculum/status`
Evaluates eligibility, completion, and major progress for a student in a program.

**Request Body:**
```json
{
  "program": "BBA",
  "completed": ["ENG102", "ACT201"],
  "waived": ["BUS112"],
  "major": "FIN"
}
```

**Status Rules:**

| Status | Condition |
|---|---|
| `done` | Course code (or alias) is in the `completed` list |
| `waived` | Course code is in the `waived` list; satisfies prereqs but adds 0 credits |
| `available` | Not done/waived, all prerequisite groups satisfied, `completedCredits >= min_credits` |
| `maybe` | Course has `has_waiver_option`, `special = "ALL_COURSEWORK"`, or `has_alternative` |
| `locked` | One or more prerequisite groups are not yet satisfied |

**Response:**
```json
{
  "courseMap": { "ENG102": "done", "ACT202": "locked", "BUS112": "waived" },
  "summary": {
    "completedCredits": 61,
    "requiredCredits": 138,
    "remainingCredits": 77,
    "catalogCredits": 238,
    "completedCourses": 29,
    "waivedCourses": 0,
    "totalCourses": 88
  },
  "majorProgress": {
    "core": { "done": 2, "total": 8 },
    "elective": { "done": 0, "total": 4 }
  }
}
```

---

### `GET /api/meta`
Returns aggregate statistics for the course section database.

```json
{
  "totalSections": 3814,
  "totalCourses": 735,
  "departments": ["ACT", "CSE", "EEE", "..."]
}
```

---

### `GET /api/health`
Returns health status of all services.

```json
{
  "api": "ok",
  "postgres": "ok",
  "redis": "ok"
}
```

> Redis status may be `"down"` if the Redis container is stopped; the API and all endpoints continue to function normally.

---

## ⚙️ Environment Configuration

Copy `.env.example` to `.env` and fill in your values:

```env
# API Server
PORT=5000
NODE_ENV=development

# PostgreSQL
POSTGRES_USER=smartadvisor
POSTGRES_PASSWORD=smartadvisor_secret
POSTGRES_DB=smartadvisor_db
POSTGRES_PORT=5432
DATABASE_URL=postgres://smartadvisor:smartadvisor_secret@localhost:5432/smartadvisor_db

# Redis
REDIS_URL=redis://localhost:6379

# Web Client (Next.js)
NEXT_PUBLIC_API_URL=http://localhost:5000/api

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=500
```

---

## 💻 Running the Application

### Option A: Docker Compose (Recommended)

```bash
docker compose up --build
```

All 5 services start in dependency order: `postgres → redis → api → web → nginx`.

| Service | URL |
|---|---|
| Web Application | `http://localhost/` |
| API Health Check | `http://localhost/api/health` |
| Curriculum Programs | `http://localhost/api/curriculum/programs` |
| Meta Statistics | `http://localhost/api/meta` |

---

### Option B: Local Development

#### 1. Start the API Server
```bash
cd apps/api
npm install
npm run seed     # Seed PostgreSQL with course data (requires a running Postgres instance)
npm run dev      # Dev server with --watch on http://localhost:5000
```

#### 2. Start the Web Client
```bash
cd apps/web
npm install
npm run dev      # Next.js dev server on http://localhost:3000
```

> **Note:** For local development, ensure PostgreSQL is running and `DATABASE_URL` is set in `.env`. Redis is optional — the app falls back gracefully if unavailable.

---

## 🧪 Automated Testing

### Running Tests
```bash
cd apps/api
npm test         # Runs all 74 Jest tests (--runInBand --detectOpenHandles --forceExit)
```

Tests run against an **in-memory PostgreSQL database** (`pg-mem`) — no live database or Redis required.

---

### Test Suites Overview

| Test File | Suite Description | Tests |
|---|---|---|
| `sections.test.js` | Search, filters, sorting, pagination, and input validation for `/api/sections` | ~15 |
| `curriculumParser.test.js` | Unit tests for `deriveGroup`, `parseCodeAndName`, `parsePrerequisites`, alias resolution, cycle detection | ~20 |
| `curriculumApi.test.js` | GET `/api/curriculum` endpoint – group structure, course fields, section stats | ~10 |
| `curriculumStatus.test.js` | POST `/api/curriculum/status` – eligibility rules, waiver logic, co-requisite handling | ~10 |
| `degreeCredits.test.js` | Graduation credit requirements, clamping, progress percent, `remainingCredits` never negative | ~11 |
| `metaAndHealth.test.js` | GET `/api/meta` counts, GET `/api/health`, Redis offline resilience simulation | 3 |
| `bbaCurriculum.test.js` | Phase 3 multi-program BBA acceptance checks (12 full scenario tests) | ~12 |

**Total: 74 tests across 7 suites**

---

### Key Test Scenarios

#### Parser Unit Tests (`curriculumParser.test.js`)
- `deriveGroup()` correctly classifies codes into `CSE Electives`, `General Education`, `Math & Science`, `Engineering Foundation`, `CSE Core`
- Slash-separated alias codes (`ENV203/GEO205`) parsed to primary + alias
- Dual-code dual-name courses (`PHI401/PHI104`) resolved correctly
- Lab suffixes (`BIO103L`, `PHY107L`, `CHE101L`) handled without stripping
- BBA duplicate rows (`HRM370`, `MKT382`) merged into single entries with dual major memberships
- **Cycle detection:** artificial cycle `A → B → C → A` throws a descriptive error; real CSE/BBA files pass clean

#### Sections API Tests (`sections.test.js`)
- Single-word search `ACT201` returns only `ACT201` sections
- Day keyword search `monday` returns only sections with `M` in `days`
- Multi-word search `ACT201 ARM` requires ALL words to match
- `openOnly=true` returns only sections with `seats > 0`
- Department filter `dept=ACT` returns only ACT sections
- Invalid parameters return `400` with descriptive error messages

#### Degree Credit Tests (`degreeCredits.test.js`)
- `GET /api/curriculum/programs` returns `requiredCredits: 138` (CSE) and `130` (BBA)
- Starting with no completed courses: `completedCredits = 0`, `remainingCredits = requiredCredits`
- Completing all courses: progress % capped at `100`; `remainingCredits` clamped to `0`
- `PROGRAMS_CONFIG` single source of truth verified against live API response

#### Resilience Tests (`metaAndHealth.test.js`)
- `GET /api/meta` returns exactly `3814` total sections and `735` total courses
- `GET /api/health` returns `api: "ok"`, `postgres: "ok"`, `redis: "ok"|"down"`
- **Redis offline simulation:** `getCache`/`setCache` replaced with rejection functions; search still returns correct results with status `200`

---

## 🖱️ Manual Testing

### Prerequisites
- Application running at `http://localhost/` (Docker) or `http://localhost:3000` (local dev)
- API accessible at `http://localhost/api` (Docker) or `http://localhost:5000/api` (local dev)

---

### MT-01: Course Section Search

| # | Steps | Expected Result |
|---|---|---|
| 1 | Open the app → go to **Course Finder** tab | Section listing loads with total count shown |
| 2 | Type `ACT201` in the search box | Only ACT201 sections appear |
| 3 | Type `monday` in the search box | Only sections with days containing `M` appear |
| 4 | Type `ACT201 ARM` in the search box | Only ACT201 sections taught by faculty `ARM` appear |
| 5 | Clear search → toggle **Open Only** | Only sections with available seats (seats > 0) appear |
| 6 | Select a department from the **Department** dropdown | Sections filtered to that department only |
| 7 | Click a column header to sort | List re-sorts; click again reverses order |
| 8 | Navigate to next page | Correct next page of results loads |

---

### MT-02: Curriculum Tracker – Course Completion

| # | Steps | Expected Result |
|---|---|---|
| 1 | Switch to **Curriculum Tracker** tab | CSE curriculum loads grouped by category |
| 2 | Select **BBA** from the program switcher | BBA curriculum loads; CSE ticks are preserved |
| 3 | Switch back to **CSE** | CSE ticks are still present (per-program persistence) |
| 4 | Tick a course (e.g., `CSE115`) | Course marked as done; dependent courses re-evaluate eligibility |
| 5 | Reload the page | Ticked courses persist from `localStorage` |
| 6 | Untick a previously ticked course | Courses that depended on it revert to `locked` if prereqs no longer met |

---

### MT-03: Prerequisite Eligibility

| # | Steps | Expected Result |
|---|---|---|
| 1 | Open CSE tracker with no courses ticked | Entry-level courses show `available`; prereq-gated courses show `locked` |
| 2 | Tick `CSE115` (prereq for `CSE173`) | `CSE173` status changes from `locked` to `available` |
| 3 | Open BBA tracker → tick `ENG102` | `ENG103` changes from `locked` to `available` |
| 4 | Toggle **Waive ENG102** (waivable toggle) | `ENG103` becomes `available` without ENG102 contributing to credit count |
| 5 | Tick enough courses to reach 100 credits | `MGT489` (100 cr threshold) changes from `locked` to `available` |

---

### MT-04: Credit Progress Meter

| # | Steps | Expected Result |
|---|---|---|
| 1 | Open CSE tracker with no ticks | Progress bar shows 0 / 138 credits (0%) |
| 2 | Tick several courses | Progress bar and credit counter update live |
| 3 | Tick enough CSE courses to exceed 138 credits | Progress bar shows 100%; banner shows "Credit requirement met" in green; extra credits shown as `+X extra cr` |
| 4 | Switch to BBA tracker | Separate BBA progress shown (0 / 130 credits) |

---

### MT-05: BBA Major Filter

| # | Steps | Expected Result |
|---|---|---|
| 1 | Open BBA tracker | All courses visible across all groups |
| 2 | Select **FIN** from the major dropdown | Only FIN major courses highlighted/filtered |
| 3 | Tick some FIN core courses | Major progress shows `core: X/Y` updated |
| 4 | Select **HRM** from the major dropdown | HRM courses shown; `HRM370` appears (dual-major course) |
| 5 | Select **MGT** from the major dropdown | `HRM370` appears again (it is also MGT Core) |

---

### MT-06: Redis Resilience

| # | Steps | Expected Result |
|---|---|---|
| 1 | Run `docker compose stop redis` | Redis container stops |
| 2 | Perform a course search in the app | Search results still load correctly (database fallback) |
| 3 | Check `GET /api/health` | Returns `redis: "down"`, `api: "ok"`, `postgres: "ok"` |
| 4 | Run `docker compose start redis` | Redis reconnects; subsequent queries are cached again |

---

### MT-07: Health & Meta Endpoints

| # | Endpoint | Steps | Expected Result |
|---|---|---|---|
| 1 | `GET /api/health` | Open in browser or Postman | `{ "api": "ok", "postgres": "ok", "redis": "ok" }` |
| 2 | `GET /api/meta` | Open in browser | `{ "totalSections": 3814, "totalCourses": 735, "departments": [...] }` |
| 3 | `GET /api/curriculum/programs` | Open in browser | Array with CSE (138 cr), BBA (130 cr), and MIC (120 cr) entries |

---

### MT-08: Rate Limiting

| # | Steps | Expected Result |
|---|---|---|
| 1 | Send 500 rapid requests to `/api/sections` within 15 minutes | Requests succeed (200) |
| 2 | Send request #501 within the same 15-minute window | Returns HTTP `429 Too Many Requests` |

---

## ✅ Acceptance Checks & Results

All 12 Phase 3 acceptance checks have been executed and verified:

| # | Acceptance Check | Result |
|---|---|---|
| **1** | All Phase 1 & 2 tests pass. `GET /api/curriculum?program=CSE` returns 88 courses; `program=BBA` returns 124 courses. | ✅ PASSED |
| **2** | BBA with `completed=[]` → correct `available`, `locked`, `maybe` statuses; co-req lab never blocks. | ✅ PASSED |
| **3** | `completed=["ENG102"]` → `ENG103` is `available`; `waived=["BUS112"]` → `BUS172`/`BUS135` available, `completedCredits` stays 0. | ✅ PASSED |
| **4** | `completed=["ACT201","BUS172"]` → `FIN254` is `available`. | ✅ PASSED |
| **5** | `INB372` (needs `MKT202`, `ECO104`) and `MGT314` (needs 4 prereqs): locked when missing, available when all present. | ✅ PASSED |
| **6** | `MGT489` stays `locked` until `completedCredits >= 100`; `BUS498` always `maybe`. | ✅ PASSED |
| **7** | `HRM370` and `MKT382` each exist once in `curriculum_courses` with two rows in `curriculum_course_majors`. | ✅ PASSED |
| **8** | `completed=["PHI104"]` → `PHI401` is `done` (alias resolution). | ✅ PASSED |
| **9** | Cycle check passes for real CSE/BBA files; artificial cycle `A→B→C→A` throws descriptive error. | ✅ PASSED |
| **10** | `GET /api/sections?eligibleOnly=true&program=BBA&completed=...` returns only eligible BBA sections. | ✅ PASSED |
| **11** | Stopping Redis does not break any endpoint (database fallback verified). | ✅ PASSED |
| **12** | In browser: CSE/BBA/MIC ticks persist independently per program after reload (`cf_done_CSE`, `cf_done_BBA`, `cf_done_MIC`); waive state persists per program (`cf_waived_CSE`, `cf_waived_BBA`, `cf_waived_MIC`); major dropdown works; legacy `cf_done` auto-migrates to `cf_done_CSE`. | ✅ PASSED |

---

## 📚 Generic Curriculum Parser Rules

The `parseCurriculumCsv(contentOrPath, program)` function handles both `CSE_nsu_courses.csv` and `BBA_nsu_courses.csv`:

| Rule | Description |
|---|---|
| **Alias resolution** | `ENV203/GEO205` → primary `ENV203`, alias `GEO205`. Ticking alias marks primary as done. |
| **Dual-name aliases** | `PHI401 Business Ethics / PHI104 Intro to Ethics` → primary `PHI401`, alias `PHI104`, combined name. |
| **Lab suffixes** | `BIO103L`, `PHY107L`, `CHE101L` stored with `L` suffix; treated as co-requisites. |
| **Duplicate row merging** | `HRM370` and `MKT382` appear twice in BBA CSV; merged into single `curriculum_courses` rows with dual `curriculum_course_majors` entries. |
| **Waivable courses** | `ENG102`, `BUS112`: waiving satisfies dependent prerequisites without adding credits. |
| **Co-requisites** | Stored in `coreq_codes`; never block eligibility. |
| **Credit threshold** | `Completion of 100 credits` → `min_credits = 100` (`MGT489`). |
| **All coursework rule** | `Completion of all coursework` → `special = "ALL_COURSEWORK"` (`BUS498`); always returns `maybe`. |
| **Cycle detection** | DFS graph cycle detector runs at parse/seed time; fails fast with diagnostic path on circular dependency. |

---

## 🚀 Roadmap (Future Scope)

| Phase | Feature | Description |
|---|---|---|
| **Phase 4** | Student Authentication & Cloud Sync | JWT login, server-side progress storage, cross-device sync, advisor review workflow |
| **Phase 5** | Schedule Generation & Conflict Detection | Automated timetable generator, conflict-free schedule matrix builder |
| **Phase 6** | Seat Monitoring & Live Alerts | WebSockets for live seat-drop notifications, SMS/email push alerts, waitlisting |
| **Phase 7** | Administrative Curriculum Editor | Admin web portal for editing prerequisites and curriculum catalog |

---

*Built for CSE 327 Software Engineering — North South University*
