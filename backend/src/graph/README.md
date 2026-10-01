# Graph Solver Layer (Pure Domain Engine)

## Architecture Rule: Strict Separation of Concerns
1. **Zero External Dependencies**:
   This module (`/backend/src/graph`) must **NEVER** import:
   - `express` or HTTP response objects
   - `pg` or SQL query runners
   - File system or environment configs
2. **Pure Data Input / Output**:
   The engine receives plain JavaScript objects / in-memory collections (such as `CurriculumGraph`, student completion records, available sections) and outputs pure mathematical results (topological sort, critical path calculations, conflict-free section combinations).
3. **High Cohesion, Low Coupling**:
   Changes to the database schema or REST API contracts will not break this algorithm layer.
