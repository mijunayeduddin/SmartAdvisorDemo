# SmartAdvisor 🎓
> Cross-Platform Academic Advising & Schedule Optimization System (CSE 327)

SmartAdvisor models university curricula as Directed Acyclic Graphs (DAG), calculates a student's Critical Path to Graduation, and provides real-time conflict-free alternative schedule suggestions when course sections reach full capacity.

---

## 1. Monorepo Architecture & Layout

SmartAdvisor is organized as a unified monorepo to ensure clean separation of concerns and maximum code reusability across platforms:

```text
SmartAdvisorDemo/
├── backend/                  # Node.js + Express + WebSockets + PostgreSQL Migrations
│   ├── src/
│   │   ├── config/           # Environment variables & DB config
│   │   ├── controllers/      # API handlers (e.g., health check)
│   │   ├── db/               # SQL migrations (001-005) & seed scripts
│   │   ├── graph/            # [Pure Domain] In-memory DAG solver (zero DB/API coupling)
│   │   ├── patterns/         # Explicit design pattern implementations
│   │   ├── routes/           # Express router endpoints (/api)
│   │   ├── websocket/        # Real-time WebSocket server hub
│   │   ├── app.js            # Express app middleware & route mounting
│   │   └── server.js         # HTTP + WebSocket server bootstrap
│   └── package.json
│
├── web/                      # React / Next.js Web Client (App Router, Tailwind, Zustand)
│   ├── app/                  # Dashboard page, layout, globals.css
│   ├── components/           # DAG visualizer, fallback banner, course search, live ticker
│   ├── store/                # Zustand schedule & WebSocket store
│   ├── package.json
│   └── README.md
│
├── mobile/                   # Flutter Cross-Platform Mobile Client (Upcoming)
│   └── README.md
│
├── shared/                   # Cross-platform data contracts & constants
│   ├── src/
│   │   ├── constants.js      # WebSocket events, strategy keys, enrollment statuses
│   │   └── types.js          # Shared entity type annotations
│   ├── index.js
│   └── package.json
│
├── docker-compose.yml        # PostgreSQL 16 Alpine container service
├── package.json              # Monorepo root workspace configuration
└── README.md                 # Project architecture documentation
```

---

## 2. Technology Stack

- **Backend Runtime**: [Node.js](https://nodejs.org/) (v24) + [Express.js](https://expressjs.com/) for high-throughput REST APIs.
- **Real-Time Communication**: [WebSockets (`ws`)](https://github.com/websockets/ws) for bi-directional state synchronization.
- **Relational Storage**: [PostgreSQL 16](https://www.postgresql.org/) with `pgcrypto` extension for robust UUID generation and referential integrity.
- **Containerization**: [Docker Compose](https://docs.docker.com/compose/) for isolated, zero-configuration local database orchestration.
- **Frontend Clients (Future Phases)**: React / Next.js for the desktop browser client and Flutter for the cross-platform mobile client.

---

## 3. Database Schema Design (5 Core Tables)

The PostgreSQL database schema models the academic graph, term offerings, and student records with strict integrity constraints:

1. **`students`**: Stores student identities, departments, and cumulative progress (`id` UUID, `student_id` UNIQUE, `name`, `email`, `department`, `completed_credits`).
2. **`courses`**: Vertices in the curriculum DAG catalog (`id` UUID, `code` UNIQUE, `title`, `credits`, `department`, `description`, `is_milestone`).
3. **`prerequisites`**: Directed dependency edges in the curriculum DAG (`course_id` requires `prereq_course_id`, `grade_requirement`, `is_corequisite`). Includes cycle prevention check `CHECK (course_id <> prereq_course_id)`.
4. **`sections`**: Term-specific course offerings with time schedules and capacity limits (`course_id`, `section_number`, `capacity`, `enrolled_count`, `room`, `day_of_week`, `start_time`, `end_time`, `term`).
5. **`enrollments`**: Academic registration history and grade tracking (`student_id`, `section_id`, `status` IN `('enrolled', 'waitlisted', 'completed', 'dropped')`, `grade`).

---

## 4. Design Patterns Implemented

The system incorporates three design patterns to meet Software Engineering course criteria:

- **Observer Pattern** (`backend/src/patterns/observer/`): Pushes instant seat-availability change notifications (`section:full`, `seat:available`) and cross-device schedule sync events to connected Web and Mobile WebSocket clients.
- **Strategy Pattern** (`backend/src/patterns/strategy/`): Supports swappable schedule-generation modes between **"Prioritize Milestone Courses"** (unlocks critical path prerequisite bottlenecks) and **"Minimize Campus Gaps"** (minimizes idle wait times between lectures).
- **Singleton Pattern** (`backend/src/patterns/singleton/`): Enforces a single shared PostgreSQL connection pool (`dbPool`) and a single in-memory cached instance of the curriculum DAG (`graphCache`).

> **Architectural Boundary**: The **Graph Solver** (`backend/src/graph/`) is designed with strict separation of concerns — it operates as a pure algorithmic domain engine with **zero dependencies** on Express, HTTP, or PostgreSQL drivers (high cohesion, low coupling).

---

## 5. Quickstart & Verification

### Start Database Container
```bash
docker compose up -d
```

### Run Migrations & Seed Data
```bash
npm --prefix backend run migrate
npm --prefix backend run seed
```
*Seeds the complete 130-credit-hour BSCSE curriculum (37 courses, 28 prerequisite edges) and demo student `2412800642` with 70 completed credits.*

### Start Backend Server
```bash
npm --prefix backend run dev
```

### Start Web Client (Next.js)
```bash
npm --prefix web run dev
```
*Access the SmartAdvisor Dashboard at [http://localhost:3000](http://localhost:3000).*

### Health Check Endpoint
```bash
curl http://localhost:5000/api/health
```

Expected JSON response:
```json
{
  "status": "ok",
  "service": "SmartAdvisor Backend Engine",
  "database": {
    "status": "connected",
    "latency": "18ms"
  },
  "graphCache": {
    "isLoaded": false,
    "version": 0
  },
  "websockets": {
    "activeClients": 0
  }
}
```
