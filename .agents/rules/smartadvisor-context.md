# SmartAdvisor — Project Domain Context

This workspace (`f:\SmartAdvisorTestOwn`) is the **SmartAdvisor** platform: a course section finder and multi-program curriculum progress tracker for **North South University (NSU)** students. It is a CSE 327 (Software Engineering) semester project.

## Programs Supported
- **CSE (BSCSE):** 88 courses, 138 graduation credits required
- **BBA:** 124 courses, 130 graduation credits required

## Official BSCSE Curriculum (UGC-Approved, March 2015, Effective Spring 2018)

The following table is the official semester-wise course sequence and prerequisites for NSU's BSCSE program:

| Semester | Courses | Credits/Sem |
|---|---|---|
| 1st | ENG102, MAT116, EEE154(CEE110), CSE115+CL | 8 |
| 2nd | ENG103, MAT120, MAT125, CSE173 | 12 |
| 3rd | ENG111, MAT130, PHY107+CL, CSE215+CL | 14 |
| 4th | PHI104, MAT250, PHY108+CL, CSE225+IL | 13 |
| 5th | BEN205, MAT350, EEE141+CL, CSE231+IL | 13 |
| 6th | HIS102, MAT361, CSE299 | 7 |
| 7th | HIS103, CHE101+CL, EEE111+CL, CSE332 | 14 |
| 8th | POL101/POL104, CSE311+IL, CSE323, CSE373 | 12 |
| 9th | ECO101/ECO104, BIO103+CL, CSE327, CSE331+IL | 13 |
| 10th | SOC101/ANT101/ENV203(GEO205), CSE425, EEE452 | 9 |
| 11th | ELECT1, ELECT2, CSE499A | 7.5 |
| 12th | ELECT3, OPEN ELECT, CSE499B | 7.5 |

## Tech Stack
- **Frontend:** React 18 + Next.js 14 (App Router), Vanilla CSS, zero external UI libraries
- **Backend:** Node.js + Express.js REST API
- **Database:** PostgreSQL 16 (primary), pg-mem (test fallback)
- **Cache:** Redis 7 (60s TTL on sections queries, 10m TTL on curriculum per program), non-blocking fallback
- **Proxy:** NGINX (routes `/` → web client, `/api` → Express API)
- **Tests:** Jest + Supertest (74 tests, 7 suites)

## Key Architecture Rules
- **Single source of truth** for graduation credits: `apps/api/src/config/programs.js` → `PROGRAMS_CONFIG`
  - **CSE:** 138 credits required
  - **BBA:** 130 credits required
- Never hardcode graduation credit targets in the UI — always fetch from `/api/curriculum/programs`
- Progress percent is capped at 100%; `remainingCredits` is floored at 0 (never negative)
- Redis failures must be non-blocking — all endpoints must degrade gracefully to the DB

## Project Directory Layout
```
apps/api/src/
├── config/       # programs.js — PROGRAMS_CONFIG (single source of truth for credits)
├── routes/       # sections.js, curriculum.js, meta.js, health.js
├── services/     # sectionService, curriculumService, curriculumParser, metaService, healthService
├── db/           # schema.sql, seed.js, pool.js
├── cache/        # Resilient Redis client with auto-fallback
└── tests/        # Jest + Supertest suites
```

## Core CSE Prerequisite Chain
- `CSE115` + Lab → `CSE173` (Discrete Math, prereq for CSE215 and CSE231)
- `CSE173` → `CSE215` → `CSE225` → `CSE311` → `CSE327` (core CSE progression)
- `CSE231` → `CSE332` → `CSE323` and `CSE331`
- `CSE225` + `MAT361` → `CSE373`
- `CSE299`: requires 60 credits completed (`min_credits = 60`)
- `CSE499A`: requires 100 credits + all major core/math/science/ethics/language courses
- `CSE499B`: prereq is `CSE499A`

## Parser & Domain Rules
- **Course aliases:** Slash-separated codes map to a single DB record (e.g. `ENV203/GEO205` → primary `ENV203`, alias `GEO205`)
- **Dual-code/dual-name:** e.g. `PHI401`/`PHI104` — ticking either alias marks the record as done
- **Waivable courses:** `waivable = true` only for `ENG102` (CSE) and `BUS112` (BBA); waiving satisfies prereqs but adds 0 credits
- **Co-requisites:** Stored in `coreq_codes[]`; co-reqs never block course eligibility
- **Credit-threshold prereqs:** `min_credits` field (e.g. CSE299 = 60, CSE499A = 100, MGT489 = 100)
- **`special = "ALL_COURSEWORK"`:** Status is always `maybe` with advisory text (e.g. BUS498)
- **DFS cycle detector:** Runs during seeding — hard-fails immediately if a prereq cycle is detected

## API Endpoints
| Endpoint | Purpose |
|---|---|
| `GET /api/curriculum/programs` | List programs with required/catalog credits |
| `GET /api/curriculum?program=CSE\|BBA` | Full course list grouped by category |
| `POST /api/curriculum/status` | Eligibility/completion evaluation |
| `GET /api/sections` | Section search with optional `eligibleOnly` filter |
| `GET /api/meta` | Department & section count stats |
| `GET /api/health` | PostgreSQL + Redis diagnostics |

## Course Status Values
| Status | Meaning |
|---|---|
| `done` | Course code (or alias) is in `completed[]` |
| `waived` | Code is in `waived[]`; satisfies prereqs, 0 credits |
| `available` | Not done/waived; all prereq groups satisfied; `completedCredits >= min_credits` |
| `maybe` | `has_waiver_option`, `special === "ALL_COURSEWORK"`, or `has_alternative` is true |
| `locked` | Prerequisite requirements not yet satisfied |

## Roadmap (Out of Scope for Current Phases)
- **Phase 4:** JWT auth + server-side progress storage + cloud sync
- **Phase 5:** Automated schedule generation + conflict detection
- **Phase 6:** Seat monitoring + WebSocket live alerts + SMS/email push
- **Phase 7:** Admin web portal for curriculum editing
