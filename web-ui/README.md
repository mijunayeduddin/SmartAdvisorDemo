# SmartAdvisor Web (Next.js frontend)

React / Next.js 14 (App Router) + TypeScript + Tailwind + Zustand.
Runs fully on an in-memory mock API and a simulated WebSocket, so no backend is needed yet.

## Run locally
Requirements: Node.js 18.17+ (20 LTS recommended).

    npm install
    cp .env.example .env.local
    npm run dev          # http://localhost:3000

Demo accounts (password `demo1234`): student@demo.nsu.edu, faculty@demo.nsu.edu, admin@demo.nsu.edu.
Or use the one-click buttons on the login page.

## Try the live behaviour
1. Open the app in two browser windows: one as the student, one as faculty or admin.
2. Student: request a seat in CSE225 and watch the pips and count change.
3. Student: request CSE311 (missing prerequisite) and send an override; faculty sees it in the queue.
4. Admin: press "Simulate registration rush" and watch seats drain and shortage alerts appear.
   Note: the mock lives in one browser tab's memory, so cross-window sync needs the real backend.

## Folder map
    src/app          routes (login, student/*, faculty/*, admin)
    src/components   layout shell, ui primitives, seats, schedule, requests
    src/lib          types, dag.ts, scheduler.ts, realtime.ts (socket seam), mock/ (data + fake API)
    src/store        Zustand stores: auth, advising (seats/requests), toast

## Connecting the real backend
- Replace `src/lib/mock/server.ts` with fetch() calls that keep the same function names and return shapes.
- Replace the body of `src/lib/realtime.ts` with a real WebSocket client that keeps `subscribe` / `emit`.
- Seat checks, RBAC and prerequisite validation must be enforced by the API; the client checks are UX only.
