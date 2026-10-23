# Lifeline Frontend

Disaster relief coordination frontend for **Lifeline**.

> When systems fail, communities connect.

Built with React, Vite, TypeScript, Tailwind CSS, Lucide, and React Router.

## What is implemented

**Public experience**

- Minimal landing page with the two requested actions: Request Help and Coordinator Dashboard.
- Mobile-first resident request form backed by `POST /api/reports`.
- Clear success state with request ID and pending verification status.
- No fake statistics, testimonials, or sample data.

**Coordinator experience**

- Exactly four navigation items: Overview, Requests, Operations, Deliveries.
- Overview with four metrics and live data, requests needing attention, and recent audit activity.
- Requests table with a detail panel for verify, reject, or clarification decisions.
- Operations with three tabs:
  - **Resources** — suppliers, stock, routes, with advanced management controls hidden behind “Manage resources”.
  - **Suggested Matches** — explainable suggestions explicitly labeled “Suggested — Not Approved”, plus open shortages.
  - **Human Approval** — one recommendation at a time with Approve, Modify, and Reject confirmation dialogs.
- Deliveries table with status updates for volunteers: dispatched, in transit, delivered, failed, or cancelled.
- Route blocking and replanning remain coordinator-triggered and never auto-approve.

## Requirements

- Node.js 20.19+ (Node 24 recommended)
- The Lifeline FastAPI backend running separately at `http://localhost:8000`

## Setup

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`.

Environment:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
```

The client appends `/api` internally. Do not put secrets in this file.

## Demo access

Coordinator and volunteer keys are entered at runtime from **Demo access** in the
coordinator console. They are stored only in the browser tab's `sessionStorage`
and sent as the backend's required headers:

- `X-Coordinator-Key`
- `X-Coordinator-Name`
- `X-Volunteer-Key`
- `X-Volunteer-Name`

Keys are never hardcoded, committed, or included in the build. Read-only data is
public; decisions require the matching demo key.

## API integration

The frontend uses the real backend contract documented in
[`../frontend-integration.md`](../frontend-integration.md) and the backend
OpenAPI specification. There is no silent demo fallback.

- Central typed client: `src/lib/api.ts`
- Response envelope handler: `apiRequest<T>()`
- Domain types: `src/types.ts`
- Auth/header injection: `src/lib/auth.tsx`
- Query helper: `src/lib/query.ts`

If the API is unavailable, the UI shows an explicit connection error and never
substitutes local sample data.

## Production build

```powershell
cd frontend
npm run build
npm run preview
```

`npm run build` runs `tsc --noEmit` and Vite production bundling.

## Project structure

```text
src/
├── components/     shared UI, modal, access dialog, coordinator layout
├── lib/            typed API client, auth, data query hook, formatting
├── pages/
│   ├── LandingPage.tsx
│   ├── RequestHelpPage.tsx
│   └── coordinator/
│       ├── OverviewPage.tsx
│       ├── RequestsPage.tsx
│       ├── OperationsPage.tsx
│       ├── DeliveriesPage.tsx
│       └── operations/
│           ├── ResourcesTab.tsx
│           ├── MatchesTab.tsx
│           └── ApprovalTab.tsx
├── App.tsx
├── main.tsx
├── index.css
└── types.ts
```

## Safety rules reflected in the UI

- No recommendation is approved automatically.
- Approving always opens a confirmation dialog and requires a reason.
- Suggested matches are visually distinct from approved assignments.
- Modification leaves a suggestion unapproved.
- Volunteer delivery updates require volunteer access.
- Blocked routes and shortages are surfaced with plain-language warnings.
- Replanning creates new suggestions only; it does not change approved work.

## Limitations

- This is a hackathon frontend. Demo keys use a shared-secret mechanism, not
  production authentication.
- Lists are loaded in a single page (backend limits apply); no infinite scrolling
  or pagination controls.
- No offline mode or local sample data.
- Advanced map, notification, and file-upload features are intentionally absent.
