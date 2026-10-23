# Lifeline Backend

FastAPI + SQLAlchemy + SQLite backend for **Lifeline**, a disaster resource
coordination platform. Human-in-the-loop is mandatory across the workflow:

```text
REPORT -> VERIFY -> MATCH -> REVIEW -> DELIVER -> CONFIRM & REPLAN
```

Matching is deterministic and rule-based. It is **not** trained AI. Matching only
creates proposals; a coordinator must explicitly approve a proposal before an
assignment exists or inventory is reserved.

## Requirements

- Python 3.10+
- pip

## Setup (Windows PowerShell)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

If script activation is blocked:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Set non-placeholder demo keys in `backend/.env`:

```dotenv
COORDINATOR_API_KEY=your-demo-coordinator-key
VOLUNTEER_API_KEY=your-demo-volunteer-key
```

Keys are environment-configured and are never returned by the API.

## Run

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API: http://localhost:8000
- Health: http://localhost:8000/api/health
- Interactive docs: http://localhost:8000/docs
- OpenAPI JSON: http://localhost:8000/openapi.json
- CORS: `http://localhost:5173` and `http://127.0.0.1:5173`

SQLite tables are created automatically on startup. Existing data is preserved.

## Demo data (safe to re-run)

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.seed
```

The seed is additive and idempotent. It never drops tables, deletes rows, or
overwrites existing records. It adds fictional flood reports, suppliers,
resources, routes, volunteers, an insufficient-stock scenario, and a blocked-road
scenario. All seeded records are simulation data.

## Authentication

- Coordinator endpoints: `X-Coordinator-Key`, optional `X-Coordinator-Name`
- Delivery updates: `X-Volunteer-Key`, optional `X-Volunteer-Name`
- Missing key -> `401`; invalid key -> `403`; key not configured -> `503`

This is shared demo authentication, not production identity. The name header is
recorded in the audit trail but is not cryptographically bound to the key.

## Workflow highlights

- New reports start as `pending_verification`; duplicate/uncertainty flags never
  auto-verify a report.
- Only verified `need` reports are matched.
- Matching only considers verified, active suppliers, available stock, category,
  urgency, outstanding demand, route accessibility, and travel cost.
- One matching run cannot promise the same stock twice across reports.
- Approval atomically rechecks report status, supplier eligibility, route
  accessibility, outstanding demand, and available stock, then reserves stock and
  creates exactly one assignment.
- Double approval, over-allocation, negative stock, and invalid transitions are
  rejected with `409`.
- Delivery statuses: `approved -> dispatched -> in_transit -> delivered`, with
  `failed`/`cancelled` releasing reserved stock exactly once.
- Blocking a route flags affected proposals and active assignments, recalculates
  shortages, and leaves alternatives for human review.
- Dashboard metrics are live database calculations, including outstanding demand
  and delivery completion rate.

## Tests

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
```

Test coverage includes report validation and persistence, duplicate flags, human
verification, supplier eligibility, matching determinism and stock planning,
shortages, unauthorized actions, modification/rejection, duplicate and concurrent
approval, delivery transitions, inventory release/consumption, route blocking,
human-controlled replanning, seed idempotence, dashboard calculations, and a
complete end-to-end workflow.

## Project structure

```text
backend/
├── app/
│   ├── api/
│   │   ├── router.py              # /api router aggregation
│   │   └── routes/                # reports, logistics, matches, assignments,
│   │                              # operations, audit, health
│   ├── core/
│   │   ├── config.py              # environment settings
│   │   ├── enums.py               # workflow status values
│   │   ├── security.py            # demo coordinator/volunteer auth
│   │   └── utils.py
│   ├── db/
│   │   ├── base.py
│   │   ├── init_db.py
│   │   └── session.py
│   ├── models/                    # SQLAlchemy models
│   ├── schemas/                   # Pydantic request/response schemas
│   ├── services/                  # reports, matching, approvals, deliveries,
│   │                              # routing, shortages, dashboard, audit
│   ├── main.py                    # app, CORS, exception envelopes, lifespan
│   └── seed.py                    # additive idempotent demo seed
├── tests/
├── requirements.txt
├── requirements-dev.txt
└── .env.example
```

## Frontend contract

See [../frontend-integration.md](../frontend-integration.md) for every endpoint,
request/response examples, auth headers, status values, error handling, and an
end-to-end curl walkthrough.

## Prototype limitations

- SQLite and shared demo API keys are for a single-node hackathon prototype.
- Approval uses conditional updates and a SQLite write lock; production should
  use stronger database locking, migrations, and a real identity provider.
- No background matching/auto-dispatch; replanning is coordinator-triggered.
- Audit logs are append-only through the API but not cryptographically signed.
