# SmartAdvisor Web Client 💻

Modern, high-performance web application for the **SmartAdvisor Academic Engine**, built with **Next.js (App Router)**, **Tailwind CSS**, **Zustand**, and **WebSockets**.

---

## 🌟 Key Features

1. **Topological Curriculum DAG Visualizer**:
   - Multi-stage topological degree progression with **Critical Path (`CSE311 -> CSE327 -> CSE425`)** highlighted in an amber/gold radiant glow.
   - Stage-based breakdown: Completed Foundations, Current Eligible, Milestones, Senior Core, and Capstone.
   - Interactive node selection linking directly to course catalog search.

2. **Real-Time Observer Pattern WebSocket Sync**:
   - Connected directly to `ws://localhost:5000/ws`.
   - Listens to `SEAT_UPDATE` and `SCHEDULE_SYNC` events.
   - Dynamically updates seat counts, schedule state, and re-renders DAG nodes without full page reloads.

3. **Intelligent Fallback Router Banner**:
   - When simulating registration for a full section (0 seats, e.g. `CSE311 §3`), an intelligent banner appears:
     > **`CSE311 §3 is full — here's your best alternative`**
   - Displays the recommended alternative (`CSE311 §2` with 7 seats open) and the algorithmic rationale from the Graph Solver / Fallback Router.
   - One-click **[Accept Alternative]** and **[Reject]** actions.

4. **Live NSU Data Feed Ticker**:
   - Displays `⚡ Seats last synced: Xs ago` driven by timestamps attached to updates by `seatSyncService`.
   - Live WebSocket connection status indicator with reconnect handling.
   - Manual sync trigger button to force an immediate RDS4 snapshot sync cycle.

5. **Strategy Toggle Switch**:
   - Seamlessly switch between **Milestone Priority** and **Minimize Gaps**.
   - Sends chosen strategy with each simulation request to the backend.

6. **Interactive Course Catalog & Schedule Simulator**:
   - Fast filtering by course code, title, and category (*All*, *Critical Path*, *Eligible*, *Simulated*).
   - Live section cards with capacity and open seat counters.
   - Enrolled schedule summary with total credits counter and one-click section drop.

---

## 📂 Project Structure

```
/web
├── app/
│   ├── layout.tsx             # Root layout with dark mode class and Inter typography
│   ├── page.tsx               # Main Dashboard assembling all views
│   └── globals.css            # Dark surface theme, glassmorphism, glowing critical path
├── components/
│   ├── Header.tsx             # Brand header, student profile, live WS status, and Strategy toggle
│   ├── FallbackBanner.tsx     # "X is full — here's your best alternative" card with Accept/Reject
│   ├── CourseSearchPanel.tsx  # Course search, category pills, live seat badges, simulation buttons
│   ├── DagVisualizer.tsx      # Topological DAG flow highlighting Critical Path in gold
│   ├── CurrentSchedule.tsx    # Enrolled courses table, total credits counter, time summary
│   └── LiveSyncBadge.tsx      # "Seats last synced: Xs ago" dynamic ticker
├── store/
│   └── useScheduleStore.ts    # Zustand store managing sections, courses, schedule, WS observer, fallback
└── types/
    └── index.ts               # Shared contracts for Courses, Sections, Fallbacks, and Strategies
```

---

## 🚀 Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Runs on [http://localhost:3000](http://localhost:3000) by default, connecting to the backend at [http://localhost:5000](http://localhost:5000).
