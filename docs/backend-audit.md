# Lifeline Backend Audit — 2026-10-23

Scope: full repository inspection, six-stage workflow correctness, live API
checks, tests, and fixes. Existing data was preserved; the main SQLite database
was empty at audit time and was not reset or deleted.

## Stack verified

- FastAPI `0.115.0`
- SQLAlchemy `2.1.6`
- SQLite via the Python stdlib driver
- Pydantic v2 / pydantic-settings
- pytest `8.3.3` + httpx `0.27.2`
- Uvicorn `0.30.6`

## Initial test run

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
```

Result before changes: **17 passed**.

## Audit checklist

| Area | Requirement | Initial | After fixes |
| --- | --- | --- | --- |
| Core | FastAPI app starts; `/api/health` checks DB | PASS | PASS |
| Core | `/docs` and OpenAPI available | PASS | PASS |
| Core | CORS for `localhost:5173` | PASS | PASS |
| Core | Consistent success/error envelope | PASS | PASS |
| Report | Create/list/detail, validation, pending status | PASS | PASS |
| Report | Duplicate and uncertainty flags, never auto-verify | PASS | PASS |
| Verify | Verify/reject/request clarification with reviewer, reason, time | PASS | PASS |
| Verify | Only verified need reports proceed to matching | PASS | PASS |
| Resources | Supplier/inventory/route models and constraints | PASS | PASS |
| Resources | Supplier create/list/verify | PASS | PASS |
| Resources | Supplier update/deactivate management | PARTIAL | PASS |
| Resources | Inventory restock/management without breaking reservations | PARTIAL | PASS |
| Resources | Verified + active supplier eligibility | PASS | PASS |
| Match | Verified needs, category, stock, route, travel cost, urgency | PASS | PASS |
| Match | Explainable deterministic proposals, partial fulfillment, shortages | PASS | PASS |
| Match | No inventory change before approval | PASS | PASS |
| Match | Same stock cannot be promised twice in one run | FAIL | PASS |
| Review | Coordinator auth with environment-configured keys | PASS | PASS |
| Review | Approve/modify/reject; modify stays proposed | PASS | PASS |
| Review | Approval rechecks supplier, route, demand, stock | PASS | PASS |
| Review | Atomic approval, duplicate/over-allocation prevention | PASS | PASS |
| Review | Audit actor/action/reason/time/before-after | PARTIAL | PASS |
| Deliver | Valid status transitions and timestamps | PASS | PASS |
| Deliver | Delivered consumes reservation; failed/cancelled releases once | PASS | PASS |
| Deliver | No direct assignment creation endpoint | PASS | PASS |
| Confirm | Failed reasons and unresolved shortages retained | PASS | PASS |
| Confirm | Block/unblock routes, flag affected plans | PASS | PASS |
| Confirm | Human-controlled replanning, no auto-reassignment | PASS | PASS |
| Dashboard | Live totals, shortages, blocked routes | PASS | PASS |
| Dashboard | Outstanding demand and delivery completion rate | MISSING | PASS |
| Demo data | Fictional flood scenario with shortage + blocked road | PASS | PASS |
| Demo data | Idempotent, additive, safe on fresh DB, never overwrites data | FAIL | PASS |
| Docs | Complete frontend API contract | MISSING | PASS |
| Tests | Six-stage workflow coverage | PARTIAL | PASS |
| Tests | Concurrent approval safety | MISSING | PASS |
| Tests | Seed idempotence, management, full end-to-end scenario | MISSING | PASS |

## Bugs found and fixed

1. **Matching could double-promise stock.** Proposals are non-reserving, and the
   planner reused static `quantity_available` for every report in a run. A
   per-run unallocated-stock ledger now prevents overlapping proposals across
   reports. Regenerating one report subtracts other live proposals conservatively.
2. **Seed failed on a fresh database.** It queried tables before schema creation.
   It now calls safe `init_db()` (create missing tables, never drop).
3. **Seed was destructive and not idempotent.** `--reset` dropped all tables.
   The seed is now additive-only and checks for existing fictional records.
4. **Dashboard lacked required metrics.** Added `outstanding_demand`,
   `delivery_completion_rate`, `verified_needs`, `total_reports`, and
   `delivered_assignments`.
5. **Supplier/resource management was incomplete.** Added coordinator
   `PATCH /api/suppliers/{id}` and `POST /api/resources/{id}/restock`.
6. **Approval audit lacked structured before/after data.** Added before/after
   snapshots, competing-proposal flags, and explicit no-reservation data on
   rejection.
7. **Shortage coverage counted proposals that had been flagged for review.**
   Flagged proposals no longer count as accessible coverage.
8. **No concurrency proof.** Added a two-session threaded approval test.

## Final test run

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
```

Result after changes: **25 passed**.

Live checks performed:

- Fresh temporary DB seeded twice via `python -m app.seed`: identical row counts,
  no duplicate records, second run created 0 rows.
- `/api/health` returns database `ok`.
- `/docs` returns HTTP 200.
- OpenAPI exposes **30 unique `/api` paths / 37 operations**.
- CORS preflight from `http://localhost:5173` returns the expected allow-origin.

## Preserved implementation

The existing report, verification, matching, approval, delivery, shortage,
dashboard, route-blocking, auth, and audit services were reused. No working
feature was removed, no database was reset, and no user data was deleted.
