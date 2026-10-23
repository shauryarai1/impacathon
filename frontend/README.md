# LIFELINE Frontend

The official Manus-designed LIFELINE frontend, connected to the existing
FastAPI backend.

> When systems fail, communities connect.

## Run locally

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The frontend expects the backend at `VITE_API_BASE_URL`:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
```

The dev and preview servers run on **5173**, which is allowed by the backend CORS
configuration.

## Backend-connected flows

- **Landing page** — minimal public experience with Request Help, How It Works,
  and the human-approval trust statement.
- **Request Help** — submits a real need to `POST /api/reports`; the success state
  shows the API-issued request ID and timestamp and pending-verification status.
- **Coordinator login** — `/coordinator/login` accepts the backend's shared demo
  headers:
  - `X-Coordinator-Key`
  - `X-Coordinator-Name`
  - optional `X-Volunteer-Key`
  - optional `X-Volunteer-Name`

  Access is validated against the protected `GET /api/audit-logs` endpoint before
  the workspace opens. Credentials live in memory only for the current browser
  session and are cleared on logout or refresh.
- **Overview** — live dashboard metrics, pending requests, and audit activity.
- **Requests** — lists real reports, shows API timestamps, and supports verify,
  reject, and clarification decisions with recorded reasons.
- **Operations** — suppliers, stock, routes, matching, shortages, and explicit
  human approval. Nothing is approved or dispatched automatically.
- **Deliveries** — real assignments and volunteer status updates with required
  reasons for failures/cancellations.

## Demo authentication

The FastAPI backend uses shared demo API keys, not email/password or JWT auth.
This is clearly labeled in the login UI. Keys are never hardcoded, committed, or
placed in URLs or localStorage. They are held in memory for the current browser
session and sent only as request headers. Refreshing or logging out clears them.

## Build

```bash
npm run build
```

This runs TypeScript project compilation and the Vite production build.

## Project structure

```text
src/
├── api/            typed backend contract and response-envelope client
├── components/     Manus UI primitives and dialogs
├── data/           original Manus preview fixtures (not imported by live pages)
├── layouts/        public and coordinator shells
├── lib/            auth headers, live data hook, formatting, time helpers
├── pages/          landing, request help, login, overview, requests,
│                   operations, deliveries, organizations
├── App.tsx
├── main.tsx
└── styles.css
```

## Limitations

- The backend uses demo shared keys, not production identity.
- Coordinator state is in-memory; a page refresh returns to login.
- No offline or mock fallback is used. API failures are shown to the user.
- The original Manus preview fixture module remains in the source tree for
  reference but is not imported by any live page.
