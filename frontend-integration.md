# Lifeline Backend — Frontend Integration Contract

Base URL: `http://localhost:8000`
API prefix: `/api`
Interactive OpenAPI docs: `http://localhost:8000/docs`
OpenAPI JSON: `http://localhost:8000/openapi.json`

CORS is enabled for `http://localhost:5173` and `http://127.0.0.1:5173`.
All request and response bodies use JSON.

---

## 1. Response envelope

Every endpoint returns the same envelope.

Success:

```json
{
  "success": true,
  "message": "Human-readable result",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Explanation of the failure",
  "data": null
}
```

Validation error (`422`):

```json
{
  "success": false,
  "message": "Request validation failed",
  "data": {
    "errors": [
      {
        "type": "greater_than_equal",
        "loc": ["body", "quantity"],
        "msg": "Input should be greater than or equal to 1",
        "input": 0
      }
    ]
  }
}
```

Frontend guidance: check `response.ok` **and** `body.success`; display `body.message` on failure, and use `body.data` on success.

---

## 2. Authentication

Coordinator-only actions:

```http
X-Coordinator-Key: <COORDINATOR_API_KEY from backend/.env>
X-Coordinator-Name: Demo Coordinator
```

Volunteer/provider delivery updates:

```http
X-Volunteer-Key: <VOLUNTEER_API_KEY from backend/.env>
X-Volunteer-Name: Demo Volunteer
```

Rules:

- Missing key: `401`
- Invalid key: `403`
- Server key not configured: `503`
- Credentials are environment-configured demo secrets. Never hardcode or commit them.
- The name header identifies the acting human for audit output; it is not cryptographically bound to the key. This is a prototype limitation.
- Read endpoints are public. Report submission is public. Verification, match generation, supplier/resource/route management, approval, shortages, and audit reads require a coordinator key. Assignment status updates require a volunteer key.
- There is no endpoint to read credentials, and credentials never appear in responses.

---

## 3. Domain enums

| Enum | Values |
| --- | --- |
| Report categories | `water`, `food`, `shelter`, `medical`, `road_blockage`, `other` |
| Report types | `need`, `hazard` |
| Urgency | `low`, `medium`, `high`, `critical` |
| Report status | `pending_verification`, `verified`, `rejected`, `clarification_requested` |
| Supplier verification | `pending`, `verified`, `rejected` |
| Recommendation status | `proposed`, `approved`, `rejected`, `superseded` |
| Assignment status | `approved`, `dispatched`, `in_transit`, `delivered`, `failed`, `cancelled` |
| Shortage status | `open`, `resolved` |

### Assignment transitions

```text
approved    -> dispatched | cancelled | failed
dispatched  -> in_transit | cancelled | failed
in_transit  -> delivered | cancelled | failed
delivered   -> terminal
failed      -> terminal
cancelled   -> terminal
```

Only coordinator approval creates an assignment and reserves stock. Matching proposals never reserve stock. Modification keeps a proposal in `proposed`; it still needs explicit approval.

---

## 4. Endpoint index

| Method | Path | Auth | Purpose | Success data |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | public | API + DB health | status object |
| POST | `/api/reports` | public | Submit resident need/hazard | `ReportRead` |
| GET | `/api/reports` | public | List/filter reports | `ReportRead[]` |
| GET | `/api/reports/pending` | public | Verification queue | `ReportRead[]` |
| GET | `/api/reports/{report_id}` | public | Report detail | `ReportRead` |
| GET | `/api/reports/{report_id}/reviews` | public | Human review history | `ReportReviewRead[]` |
| POST | `/api/reports/{report_id}/verify` | coordinator | Verify report | `ReportRead` |
| POST | `/api/reports/{report_id}/reject` | coordinator | Reject report | `ReportRead` |
| POST | `/api/reports/{report_id}/request-clarification` | coordinator | Request clarification | `ReportRead` |
| POST | `/api/suppliers` | coordinator | Create supplier | `SupplierRead` |
| GET | `/api/suppliers` | public | List suppliers | `SupplierRead[]` |
| GET | `/api/suppliers/{supplier_id}` | public | Supplier detail | `SupplierRead` |
| PATCH | `/api/suppliers/{supplier_id}` | coordinator | Update details/verification/active | `SupplierRead` |
| POST | `/api/suppliers/{supplier_id}/verify` | coordinator | Verify supplier | `SupplierRead` |
| POST | `/api/resources` | coordinator | Create inventory | `ResourceRead` |
| GET | `/api/resources` | public | List inventory | `ResourceRead[]` |
| GET | `/api/resources/{resource_id}` | public | Resource detail | `ResourceRead` |
| POST | `/api/resources/{resource_id}/restock` | coordinator | Increase inventory | `ResourceRead` |
| POST | `/api/routes` | coordinator | Create route | `RouteRead` |
| GET | `/api/routes` | public | List routes | `RouteRead[]` |
| GET | `/api/routes/{route_id}` | public | Route detail | `RouteRead` |
| POST | `/api/routes/{route_id}/block` | coordinator | Block route, flag plans | `RouteRead` |
| POST | `/api/routes/{route_id}/unblock` | coordinator | Reopen route | `RouteRead` |
| POST | `/api/matches` | coordinator | Generate proposals | `MatchGenerationResult` |
| GET | `/api/matches` | public | List recommendations | `RecommendationRead[]` |
| GET | `/api/matches/{recommendation_id}` | public | Recommendation detail | `RecommendationRead` |
| POST | `/api/matches/{recommendation_id}/approve` | coordinator | Approve, reserve stock, create assignment | `ApprovalResult` |
| POST | `/api/matches/{recommendation_id}/modify` | coordinator | Modify proposal (stays proposed) | `RecommendationRead` |
| POST | `/api/matches/{recommendation_id}/reject` | coordinator | Reject proposal | `RecommendationRead` |
| GET | `/api/assignments` | public | List assignments | `AssignmentRead[]` |
| GET | `/api/assignments/{assignment_id}` | public | Assignment detail | `AssignmentRead` |
| POST | `/api/assignments/{assignment_id}/status` | volunteer | Update delivery status | `AssignmentRead` |
| GET | `/api/shortages` | public | List shortage records | `ShortageRead[]` |
| POST | `/api/shortages` | coordinator | Manually report shortage | `ShortageRead` |
| POST | `/api/shortages/{shortage_id}/resolve` | coordinator | Resolve shortage | `ShortageRead` |
| GET | `/api/dashboard/metrics` | public | Live dashboard metrics | `DashboardMetrics` |
| GET | `/api/audit-logs` | coordinator | Audit trail | `AuditLogRead[]` |

---

## 5. Entity response shapes

### ReportRead

```json
{
  "id": 12,
  "reporter_name": "Aarav Singh",
  "category": "water",
  "type": "need",
  "location": "Riverside",
  "description": "Families need safe drinking water.",
  "quantity": 500,
  "urgency": "critical",
  "status": "pending_verification",
  "duplicate_of_report_id": null,
  "duplicate_score": null,
  "review_flags": [],
  "needs_review": false,
  "verified_by_id": null,
  "verified_at": null,
  "verification_reason": null,
  "created_at": "2026-10-23T12:00:00Z",
  "updated_at": "2026-10-23T12:00:00Z"
}
```

### SupplierRead

```json
{
  "id": 3,
  "name": "Bluewater Relief Depot (demo)",
  "location": "Riverside",
  "contact_name": "Nora Blake",
  "verification_status": "verified",
  "active": true,
  "created_at": "2026-10-23T12:00:00Z",
  "updated_at": "2026-10-23T12:00:00Z"
}
```

### ResourceRead

```json
{
  "id": 7,
  "supplier_id": 3,
  "name": "Sealed drinking-water cases",
  "category": "water",
  "quantity_total": 300,
  "quantity_available": 220,
  "quantity_reserved": 80,
  "created_at": "2026-10-23T12:00:00Z",
  "updated_at": "2026-10-23T12:00:00Z"
}
```

Stock invariant: `quantity_available + quantity_reserved <= quantity_total`.

### RouteRead

```json
{
  "id": 4,
  "origin": "Riverside",
  "destination": "Eastbridge",
  "travel_cost": 6.0,
  "blocked": true,
  "blocked_reason": "Main bridge is flooded.",
  "blocked_at": "2026-10-23T12:00:00Z",
  "created_at": "2026-10-23T12:00:00Z",
  "updated_at": "2026-10-23T12:00:00Z"
}
```

### RecommendationRead

```json
{
  "id": 9,
  "report_id": 12,
  "resource_id": 7,
  "supplier_id": 3,
  "route_id": null,
  "quantity": 80,
  "status": "proposed",
  "rationale": "Verified water need at Riverside ... Proposed 80 unit(s).",
  "route_cost": 0.0,
  "needs_review": false,
  "review_reason": null,
  "reviewed_by_id": null,
  "reviewed_at": null,
  "created_at": "2026-10-23T12:00:00Z",
  "updated_at": "2026-10-23T12:00:00Z",
  "report_location": "Riverside",
  "report_category": "water",
  "report_status": "verified",
  "report_urgency": "critical",
  "report_quantity": 100,
  "resource_name": "Sealed drinking-water cases",
  "supplier_name": "Bluewater Relief Depot (demo)",
  "supplier_location": "Riverside",
  "assignment_id": null,
  "assignment_status": null,
  "remaining_shortage": 20
}
```

### AssignmentRead

```json
{
  "id": 5,
  "recommendation_id": 9,
  "report_id": 12,
  "resource_id": 7,
  "supplier_id": 3,
  "route_id": null,
  "quantity": 80,
  "status": "approved",
  "volunteer_id": null,
  "created_by_id": 1,
  "approval_reason": "Verified water delivery route.",
  "confirmation_note": null,
  "failure_reason": null,
  "needs_review": false,
  "review_reason": null,
  "inventory_released": false,
  "inventory_consumed": false,
  "created_at": "2026-10-23T12:00:00Z",
  "updated_at": "2026-10-23T12:00:00Z",
  "dispatched_at": null,
  "delivered_at": null,
  "recommendation_quantity": 80,
  "report_location": "Riverside",
  "report_category": "water",
  "report_urgency": "critical",
  "resource_name": "Sealed drinking-water cases",
  "supplier_name": "Bluewater Relief Depot (demo)",
  "volunteer_name": null,
  "volunteer_organization": null,
  "coordinator_name": "Demo Coordinator"
}
```

### ShortageRead

```json
{
  "id": 2,
  "report_id": 12,
  "quantity": 20,
  "reason": "Unmet demand of 20 unit(s) ...",
  "status": "open",
  "source": "auto",
  "reported_by_id": null,
  "created_at": "2026-10-23T12:00:00Z",
  "updated_at": "2026-10-23T12:00:00Z",
  "resolved_at": null,
  "report_location": "Riverside",
  "report_category": "water",
  "report_urgency": "critical"
}
```

### DashboardMetrics

```json
{
  "total_requests": 2,
  "pending_verification": 0,
  "approved_assignments": 2,
  "completed_deliveries": 1,
  "shortages": 1,
  "blocked_routes": 1,
  "total_reports": 2,
  "verified_needs": 2,
  "delivered_assignments": 1,
  "outstanding_demand": 20,
  "delivery_completion_rate": 50.0,
  "verified_requests": 2,
  "clarification_requested": 0,
  "proposed_matches": 0,
  "active_assignments": 1,
  "failed_deliveries": 0,
  "cancelled_assignments": 0,
  "open_shortage_units": 20,
  "available_inventory_units": 0,
  "reserved_inventory_units": 50
}
```

Definitions:

- `outstanding_demand`: units on verified need reports not yet covered by approved/delivered assignments. Proposals do not count.
- `delivery_completion_rate`: `delivered assignments / total assignments * 100`, rounded to one decimal. `0.0` when no assignments exist.
- `shortages`: number of open shortage records.
- `open_shortage_units`: sum of open shortage quantities.

### AuditLogRead

```json
{
  "id": 41,
  "action": "recommendation_approved",
  "entity_type": "recommendation",
  "entity_id": 9,
  "actor_type": "coordinator",
  "actor_name": "Demo Coordinator",
  "reason": "Verified water delivery route.",
  "details": {
    "before": { "recommendation_status": "proposed" },
    "after": { "recommendation_status": "approved", "assignment_id": 5 }
  },
  "created_at": "2026-10-23T12:00:00Z"
}
```

---

## 6. Endpoint request examples

### Health

```http
GET /api/health
```

### Report

Create:

```http
POST /api/reports
Content-Type: application/json

{
  "reporter_name": "Aarav Singh",
  "category": "water",
  "type": "need",
  "location": "Riverside",
  "description": "Families need safe drinking water after the flood.",
  "quantity": 500,
  "urgency": "critical"
}
```

List with filters (all optional):

```http
GET /api/reports?status=verified&category=water&type=need&location=Riverside&limit=100
```

Detail and reviews:

```http
GET /api/reports/12
GET /api/reports/12/reviews
GET /api/reports/pending
```

Verification actions all use the same body:

```http
POST /api/reports/12/verify
POST /api/reports/12/reject
POST /api/reports/12/request-clarification
X-Coordinator-Key: $COORDINATOR_API_KEY
X-Coordinator-Name: Demo Coordinator
Content-Type: application/json

{ "reason": "Identity and need confirmed by phone." }
```

### Supplier

```http
POST /api/suppliers
X-Coordinator-Key: $COORDINATOR_API_KEY
X-Coordinator-Name: Demo Coordinator
Content-Type: application/json

{
  "name": "Bluewater Relief Depot (demo)",
  "location": "Riverside",
  "contact_name": "Nora Blake",
  "verification_status": "verified",
  "active": true
}
```

```http
GET /api/suppliers?verification_status=verified&active=true
GET /api/suppliers/3
PATCH /api/suppliers/3
POST /api/suppliers/3/verify

# PATCH body:
{
  "active": false,
  "contact_name": "New Contact",
  "reason": "Supplier temporarily paused."
}

# verify body:
{ "reason": "Documents checked." }
```

### Resource

```http
POST /api/resources
X-Coordinator-Key: $COORDINATOR_API_KEY
X-Coordinator-Name: Demo Coordinator
Content-Type: application/json

{
  "supplier_id": 3,
  "name": "Sealed drinking-water cases",
  "category": "water",
  "quantity_available": 300
}
```

```http
GET /api/resources?supplier_id=3&category=water
GET /api/resources/7

POST /api/resources/7/restock
{
  "quantity": 50,
  "reason": "Emergency resupply arrived."
}
```

The restock endpoint only increases total and available stock. Reserved stock is never altered by restocking.

### Route

```http
POST /api/routes
X-Coordinator-Key: $COORDINATOR_API_KEY
X-Coordinator-Name: Demo Coordinator
Content-Type: application/json

{
  "origin": "Northside",
  "destination": "Eastbridge",
  "travel_cost": 3.0,
  "blocked": false
}
```

```http
GET /api/routes?blocked=true
GET /api/routes/4

POST /api/routes/4/block
{ "reason": "Floodwater covered the road." }

POST /api/routes/4/unblock
{ "reason": "Road inspected and reopened." }
```

### Matching

Generate for all verified needs:

```http
POST /api/matches
X-Coordinator-Key: $COORDINATOR_API_KEY
X-Coordinator-Name: Demo Coordinator
Content-Type: application/json

{
  "replace_proposed": true
}
```

Generate for one report:

```json
{
  "report_id": 12,
  "replace_proposed": true
}
```

List and detail:

```http
GET /api/matches?status=proposed&report_id=12
GET /api/matches/9
```

Matching response:

```json
{
  "success": true,
  "message": "Generated 1 proposal(s) for human review; no stock was reserved and no assignment was created",
  "data": {
    "generated_count": 1,
    "superseded_count": 0,
    "recommendations": ["...RecommendationRead..."],
    "shortages": ["...ShortageRead..."]
  }
}
```

### Human review

Approve:

```http
POST /api/matches/9/approve
X-Coordinator-Key: $COORDINATOR_API_KEY
X-Coordinator-Name: Demo Coordinator
Content-Type: application/json

{ "reason": "Verified water delivery route." }
```

Approve response `data`:

```json
{
  "recommendation": "...RecommendationRead with status approved...",
  "assignment": "...AssignmentRead with status approved...",
  "supplier": "...SupplierRead..."
}
```

Modify (remains `proposed`; does not reserve stock):

```json
{
  "reason": "Reduce the delivery to match confirmed storage.",
  "quantity": 60,
  "resource_id": 7
}
```

Reject:

```json
{
  "reason": "Supplier cannot reach the area today."
}
```

### Delivery

List and detail:

```http
GET /api/assignments?status=approved
GET /api/assignments?report_id=12
GET /api/assignments/5
```

Advance status:

```http
POST /api/assignments/5/status
X-Volunteer-Key: $VOLUNTEER_API_KEY
X-Volunteer-Name: Demo Volunteer
Content-Type: application/json

{ "status": "dispatched" }
```

```json
{ "status": "in_transit" }
```

Delivered:

```json
{
  "status": "delivered",
  "note": "Delivered to shelter lead; signed receipt collected."
}
```

Failed:

```json
{
  "status": "failed",
  "failure_reason": "Road became impassable before the truck arrived."
}
```

Cancelled:

```json
{
  "status": "cancelled",
  "note": "Supplier vehicle unavailable before dispatch."
}
```

Invalid transitions return `409`. `failed` and `cancelled` require a reason. Terminal assignments cannot be updated again.

### Shortages

```http
GET /api/shortages?status=open&report_id=12

POST /api/shortages
X-Coordinator-Key: $COORDINATOR_API_KEY
X-Coordinator-Name: Demo Coordinator
Content-Type: application/json

{
  "report_id": 12,
  "quantity": 25,
  "reason": "Additional baby formula shortage reported by the shelter."
}

POST /api/shortages/3/resolve
{ "reason": "Emergency formula delivery confirmed." }
```

### Dashboard and audit

```http
GET /api/dashboard/metrics

GET /api/audit-logs?entity_type=recommendation&entity_id=9&action=recommendation_approved&limit=100
X-Coordinator-Key: $COORDINATOR_API_KEY
X-Coordinator-Name: Demo Coordinator
```

---

## 7. Error handling

| Status | When |
| --- | --- |
| `400` | General bad request |
| `401` | Protected endpoint called without the required key header |
| `403` | Wrong key, or inactive coordinator/volunteer |
| `404` | Report/supplier/resource/route/match/assignment/shortage not found |
| `409` | Duplicate approval, duplicate review, invalid transition, blocked route, insufficient stock, over-allocation, terminal-state change |
| `422` | Pydantic validation failure (missing fields, bad enums, negative quantity, missing decision reason) |
| `500` | Unexpected database/server error |
| `503` | Demo key not configured on the server |

Common `409` messages are safe to show to the user. Refresh the relevant list after a `409`; state may have changed.

---

## 8. Example end-to-end API flow (curl)

Set environment values first; never paste real keys into source files:

```bash
export API=http://localhost:8000/api
export COORD_KEY="<COORDINATOR_API_KEY from backend/.env>"
export VOL_KEY="<VOLUNTEER_API_KEY from backend/.env>"
```

1. Submit a report:

```bash
curl -s -X POST "$API/reports" \
  -H "Content-Type: application/json" \
  -d '{
    "reporter_name": "Aarav Singh",
    "category": "water",
    "type": "need",
    "location": "Riverside",
    "description": "Families need safe drinking water after the flood.",
    "quantity": 100,
    "urgency": "critical"
  }'
```

2. Coordinator verifies it:

```bash
curl -s -X POST "$API/reports/1/verify" \
  -H "Content-Type: application/json" \
  -H "X-Coordinator-Key: $COORD_KEY" \
  -H "X-Coordinator-Name: Demo Coordinator" \
  -d '{"reason":"Need confirmed by shelter coordinator."}'
```

3. Create a verified supplier and inventory:

```bash
curl -s -X POST "$API/suppliers" \
  -H "Content-Type: application/json" \
  -H "X-Coordinator-Key: $COORD_KEY" \
  -H "X-Coordinator-Name: Demo Coordinator" \
  -d '{"name":"Riverside Water Point","location":"Riverside","verification_status":"verified","active":true}'

curl -s -X POST "$API/resources" \
  -H "Content-Type: application/json" \
  -H "X-Coordinator-Key: $COORD_KEY" \
  -H "X-Coordinator-Name: Demo Coordinator" \
  -d '{"supplier_id":1,"name":"Bottled water","category":"water","quantity_available":80}'
```

4. Generate proposals:

```bash
curl -s -X POST "$API/matches" \
  -H "Content-Type: application/json" \
  -H "X-Coordinator-Key: $COORD_KEY" \
  -H "X-Coordinator-Name: Demo Coordinator" \
  -d '{"report_id":1,"replace_proposed":true}'
```

5. Confirm stock is unchanged before approval:

```bash
curl -s "$API/resources/1"
# quantity_available should still be 80, quantity_reserved 0
```

6. Approve the proposal (replace `9` with the returned recommendation id):

```bash
curl -s -X POST "$API/matches/9/approve" \
  -H "Content-Type: application/json" \
  -H "X-Coordinator-Key: $COORD_KEY" \
  -H "X-Coordinator-Name: Demo Coordinator" \
  -d '{"reason":"Explicit human approval for delivery."}'
```

7. Volunteer advances the assignment (replace `5` with the returned assignment id):

```bash
for STATUS in dispatched in_transit delivered; do
  curl -s -X POST "$API/assignments/5/status" \
    -H "Content-Type: application/json" \
    -H "X-Volunteer-Key: $VOL_KEY" \
    -H "X-Volunteer-Name: Demo Volunteer" \
    -d "{\"status\":\"$STATUS\",\"note\":\"Delivery update\"}"
done
```

8. Block a route and replan:

```bash
curl -s -X POST "$API/routes/4/block" \
  -H "Content-Type: application/json" \
  -H "X-Coordinator-Key: $COORD_KEY" \
  -H "X-Coordinator-Name: Demo Coordinator" \
  -d '{"reason":"Bridge flooded."}'

curl -s -X POST "$API/matches" \
  -H "Content-Type: application/json" \
  -H "X-Coordinator-Key: $COORD_KEY" \
  -H "X-Coordinator-Name: Demo Coordinator" \
  -d '{"replace_proposed":true}'
```

Replanning only creates proposals. It never approves, reassigns, or dispatches.

9. Check the live dashboard:

```bash
curl -s "$API/dashboard/metrics"
```

---

## 9. Demo data

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.seed
```

The seed is additive and idempotent. It never drops tables or overwrites existing rows. It includes:

- fictional flood reports (including a likely duplicate and an uncertain report),
- verified/unverified/inactive suppliers,
- water, food, medical, and shelter inventory,
- an insufficient-stock scenario (100 medical units vs. 120 requested), and
- a blocked Riverside ↔ Eastbridge bridge.

All names/locations in the seed are fictional simulation data.

---

## 10. Prototype limitations

- Demo API keys are shared secrets configured in `.env`, not production authentication. The `X-*-Name` header is attribution data and should not be treated as verified identity.
- SQLite and the in-process API are appropriate for a hackathon prototype. Approval writes use `BEGIN IMMEDIATE` to serialize critical sections; production needs proper database row locking and migrations.
- List endpoints use simple limits, not full pagination.
- Shortage coverage is calculated from committed assignments plus currently accessible proposals. Dashboard `outstanding_demand` intentionally counts only demand not yet covered by approved/delivered assignments.
- Replanning is coordinator-triggered. There is no background automation and no automatic reassignment.
- Audit rows are append-only through the API but are not cryptographically tamper-evident.
- No file uploads, SMS/email, maps, payments, or external AI services are implemented.
