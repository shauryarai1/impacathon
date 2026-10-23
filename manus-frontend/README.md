# LIFELINE

LIFELINE is a polished React/Vite frontend for disaster relief coordination: residents request essential supplies, coordinators verify needs and approve allocations, and volunteers keep delivery status visible.

> When systems fail, communities connect.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

The frontend expects the existing FastAPI backend at `VITE_API_BASE_URL`. The preview is intentionally self-contained when `VITE_USE_DEMO_DATA=true` (the default shown in `.env.example`).

## Demo mode and access

The UI uses clearly labeled DEMO DATA so the public and coordinator flows can be reviewed without silently pretending the backend contract is known. Demo records contain fixed fixture timestamps only so the formatter can be reviewed; live timestamps must come from the API response. Demo data can be disabled with `VITE_USE_DEMO_DATA=false`; the UI then shows that live API wiring is required instead of substituting records when requests fail.

Coordinator access is now behind `/coordinator/login`. The local “Use demo access” control is a preview gate, not production-grade authentication. The typed API client exposes a placeholder for the backend’s existing coordinator auth flow. Optional `VITE_DEMO_COORDINATOR_EMAIL` and `VITE_DEMO_COORDINATOR_PASSWORD` values can be used for a local credential check; no real credentials are hardcoded or committed.

## Business model

Emergency requests remain free for residents, and relief delivery remains free for volunteers. The separate For Organizations page describes a proposed B2G/B2NGO model: NGOs and municipalities may license the coordination dashboard and optionally purchase future services such as multi-team coordination, onboarding, operational reports, training, managed hosting, and deployment support. These are proposed services, not implemented features. There are no payment gateways, subscriptions, ads, donations, or resident charges in this project. The “Partner with us” CTA uses an explicitly labeled email placeholder because no contact endpoint is available.

## Backend integration boundary

`src/api/client.ts` is the centralized typed adapter. It reads `VITE_API_BASE_URL`, provides a consistent response-envelope parser, and exposes placeholders for coordinator authentication, dashboard metrics, request submission and verification, matching, and related operations. Placeholder methods intentionally throw `ApiContractUnavailableError` until the real `frontend-integration.md` or FastAPI OpenAPI specification is supplied. Replace the paths, headers, payloads, and response schemas from that contract; do not infer them from the demo records.

The current project does not contain `frontend-integration.md` or an OpenAPI export, so two backend-owned fields are explicitly unresolved rather than fabricated: the request submission timestamp field and the coordinator authentication request/response contract. When the API returns an ISO-8601 submission timestamp, the Requests table shows it in the viewer’s local timezone plus a relative timestamp, while the detail panel preserves the original instant. If the field is absent, the UI says so. The resident confirmation likewise identifies the missing backend timestamp in demo mode.

The UI interaction model is structured around the integration boundary: request verification and clarification, suggested matches, explicit human approval confirmation, route blocking/replanning, delivery updates, and audit trail language are all represented locally for the preview. In the connected version, approval must remain an explicit server-side action and must not reserve stock, create an assignment, or dispatch supplies before approval.

## Production check

```bash
npm run build
```

The static page route manifest is available at `/manus-routes.json` for the managed Webdev Preview.
