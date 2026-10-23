# Approval Module (Developer 03)

Human-in-the-loop review for match recommendations.

## Ownership

Files owned and changed by this module:

- `backend/app/services/approvals.py` — approval, modification, rejection, assignment creation, reservation, audit entries.
- `backend/tests/test_approval.py` — module tests.
- `backend/app/services/APPROVAL_MODULE.md` — this contract note.

The HTTP handlers currently live in the shared
`backend/app/api/routes/matches.py` and call into this service. They were not
modified here because that file is shared with the matching module.

## Shared dependencies expected from other developers

No competing models were invented. This module uses the existing shared
SQLAlchemy models and infrastructure:

| Dependency | Location | Used for |
| --- | --- | --- |
| `Coordinator` | `app/models/coordinator.py` | human actor identity |
| `Recommendation` | `app/models/recommendation.py` | proposal and review status |
| `Resource` | `app/models/resource.py` | available/reserved stock |
| `Supplier` | `app/models/supplier.py` | active/verified supply checks |
| `Report` | `app/models/report.py` | verified need and outstanding demand |
| `Assignment` | `app/models/assignment.py` | delivery assignment created on approval |
| `AuditLog` | `app/models/audit.py` | decision trail |
| `get_db` | `app/db/session.py` | request-scoped session |
| `get_current_coordinator` | `app/core/security.py` | env-configured coordinator auth |
| `add_audit` | `app/services/audit.py` | audit entry helper |
| `find_accessible_route` / `route_is_accessible` | `app/services/routing.py` | route validation |
| `refresh_report_shortage` / `shortage_quantity` | `app/services/shortages.py` | unmet-demand refresh |
| `committed_quantity`, `*_view` | `app/services/presenters.py` | demand check and response shapes |

## Endpoints

Registered under the shared API router:

- `POST /api/matches/{id}/approve`
- `POST /api/matches/{id}/modify`
- `POST /api/matches/{id}/reject`
- `GET /api/audit-logs` (shared audit read endpoint)

Coordinator headers:

```text
X-Coordinator-Key: <COORDINATOR_API_KEY from backend/.env>
X-Coordinator-Name: <human coordinator name>
```

Missing key -> `401`; invalid key -> `403`; unconfigured server key -> `503`.
The key is never returned by the API.

## Human-in-the-loop invariants

1. Matching only creates `proposed` recommendations. It does not approve.
2. `approve` is the only operation that creates an `Assignment` and moves stock
   from `quantity_available` to `quantity_reserved`.
3. `modify` changes a pending proposal and leaves it `proposed`; approval is still
   required.
4. `reject` creates no assignment and reserves no stock.
5. Only `proposed` recommendations can be reviewed; repeated decisions return
   `409`.
6. Approval re-validates: verified need report, matching category, verified and
   active supplier, accessible route, available stock, and outstanding demand.
7. Conditional `UPDATE` statements plus a unique assignment constraint prevent
   duplicate approvals and negative/over-allocated stock.
8. On SQLite, approval writes acquire `BEGIN IMMEDIATE` so concurrent decisions
   serialize before the outstanding-demand check.
9. Approval, reservation, assignment creation, shortage refresh, and audit
   entries commit in one transaction.
10. Every decision records coordinator, reason, timestamp, and before/after
    details in the audit trail.

## Tests

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests\test_approval.py -q
```

Covered cases: missing/invalid coordinator key, approval creates assignment and
reservation, duplicate approval, direct-assignment rejection, modification,
rejection, over-demand/over-stock guards, audit entries, and inventory
consistency.

## Integration notes / limitations

- The shared route file already imports this service; no re-registration is
  needed. If approval routes are later moved into a dedicated module router, the
  shared `matches.py` handlers must be removed first to avoid duplicate routes.
- Authentication is a shared demo key, not production identity. The name header
  is attribution data, not a signed identity.
- SQLite is appropriate for this single-process hackathon prototype. The
  write-lock guard is SQLite-specific; a production deployment should use
  database row locks/transactions instead.
