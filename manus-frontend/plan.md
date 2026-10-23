# LIFELINE — Implementation & Design Plan

## Scope and approach

LIFELINE will be built as a new React + Vite + TypeScript frontend with Tailwind CSS, Lucide icons, and React Router. The frontend will provide two clear experiences:

1. A public resident flow with a minimal landing page and a mobile-first request form that ends in an explicit success state.
2. A coordinator/volunteer workspace with exactly four primary navigation items: Overview, Requests, Operations, and Deliveries.

The backend remains the existing FastAPI service at `VITE_API_BASE_URL`. Because the backend contract is not included yet, the project will include a centralized typed API adapter with documented placeholder methods and response-envelope handling. The UI will run with explicitly labeled DEMO DATA for preview and interaction continuity; demo data will be isolated behind a single switch so it can be disabled when the real contract is connected. No fallback will silently turn failed API requests into demo data.

The coordinator workspace will use local interaction state for the prototype: request detail panels, approval confirmation, modify/reject flows, delivery status changes, route blocking, and an audit trail. These behaviors will be structured so the corresponding API calls can be connected without redesigning the screens.

## Project structure

- `src/main.tsx` — application bootstrap and router mount.
- `src/App.tsx` — public/coordinator route map and shared application shell.
- `src/api/client.ts` — typed fetch wrapper, base URL handling, response-envelope parser, and documented placeholder endpoint methods.
- `src/api/types.ts` — frontend-facing types for requests, resources, routes, matches, approvals, deliveries, dashboard metrics, and audit events.
- `src/data/demo.ts` — explicitly marked DEMO DATA and prototype state seeds.
- `src/components/` — reusable UI primitives: logo, buttons, status pills, metric cards, tables, drawers, dialogs, and empty states.
- `src/layouts/` — public shell and coordinator shell.
- `src/pages/` — Landing, Request Help, Overview, Requests, Operations, and Deliveries pages.
- `src/styles.css` — design tokens, layout primitives, typography, responsive rules, and restrained motion.
- `public/manus-routes.json` — complete static page route manifest for Preview.
- `.env.example` — `VITE_API_BASE_URL` and optional local demo access configuration names only.
- `README.md` — setup instructions, demo behavior, backend integration notes, and build command.

## Design direction

### Candidate styles

- **Operational Monochrome** (0.07): a restrained midnight command surface with crisp typography and status colors used only when they carry operational meaning.
- **Civic Editorial** (0.05): a calm public-service interface with generous whitespace, strong text hierarchy, and subtle rules.
- **Quiet Utility** (0.04): an almost tool-like system that prioritizes readable decisions over decoration.

### Chosen style: Operational Monochrome

**Design Movement:** Apple meets Linear, translated into a premium emergency operations console.

**Core Principles:** one clear action per screen; safety information is always visible; dense information is organized into calm, scannable surfaces; operational color is rare and meaningful.

**Color Philosophy:** midnight black and graphite surfaces reduce visual noise and let urgent states stand out. White is reserved for action and primary text. Amber, red, and green appear only for urgency, warnings, and operational status—not decoration.

**Layout Paradigm:** a quiet left rail anchors the coordinator workspace while the content area uses a narrow reading measure and stacked sections rather than dashboard tile sprawl. On mobile, the rail becomes a compact top bar and the resident flow becomes a single-column form.

**Signature Elements:** the LIFELINE wordmark paired with a simple four-point cross mark; fine horizontal rules that clarify hierarchy; compact status pills with short plain-English labels.

**Interaction Philosophy:** every state change explains what happened and what happens next. Approval actions are deliberately explicit and require confirmation. Unavailable backend-backed actions remain visibly marked as demo-only or not connected.

**Animation:** subtle 150–220ms opacity/transform transitions only for drawers, dialogs, and hover states. No looping motion, glow, parallax, or decorative animation.

**Typography System:** Inter via a CSS system stack fallback, with tight tracking for labels and generous line-height for public copy. Display heading sizes stay compact and intentional; body copy remains highly readable at 15–16px.

**Brand Essence:** a calm coordination layer for communities under pressure — direct, humane, dependable.

**Brand Voice:** plain, steady, and action-oriented. Example lines: “See what needs attention.” and “No supplies move until a coordinator approves the match.”

**Wordmark & Logo:** a custom text lockup using the LIFELINE name with a compact crosshair/line mark built from CSS and Lucide LineCross iconography, avoiding a generic app icon.

**Signature Brand Color:** warm amber `#D6A654`, used sparingly for urgency and attention states against the monochrome base.

## Main user flows

### Resident

- Landing page communicates the product in five seconds.
- Request Help opens a short form with need, quantity, location, urgency, optional details, and a single submit action.
- Successful submission shows a generated-looking demo request ID, status, and next-step message without sending the resident into coordinator screens.

### Coordinator

- Overview starts with exactly four metrics, then Requests Needing Attention and Recent Activity, with View Requests as the single primary action.
- Requests uses a responsive table/list with a detail drawer. The drawer supports verify, reject, request clarification, duplicate/uncertainty warnings, and a visible demo integration note.
- Operations uses three tabs: Resources, Suggested Matches, Human Approval. Human Approval presents one recommendation at a time and makes APPROVE, MODIFY, and REJECT unmistakable. Approve is confirmed before the audit trail updates.
- Deliveries supports status updates through Dispatched, In Transit, Delivered, Failed, or Cancelled and shows confirmation feedback.

### Demo access

A clearly labeled demo-only access control will be available from the coordinator entry point. It will read locally configured demo credential names from environment variables when present and will never embed secrets in source. For preview continuity, the coordinator experience can be entered through a clearly marked “Use demo access” action; all demo behavior is labeled in the UI.

## Backend integration boundary

The API adapter will expose typed methods for dashboard metrics, reports/verification, suppliers/resources, routes, suggested matches, human approvals, assignments/delivery status, shortages, and audit logs. Each method will contain a `TODO` noting that the exact path, headers, request schema, and response envelope must be replaced from `frontend-integration.md` or the backend OpenAPI specification when provided. The adapter will throw a clear `ApiContractUnavailableError` for placeholder methods rather than inventing a working contract.

## Build workflow

- Register TypeScript diagnostics through the host-managed Webdev runtime before the first source batch.
- Install only the requested lightweight dependencies.
- Implement reusable components and page routes, then add the route manifest.
- Start the Vite development server on the configured port and verify HTTP readiness plus `/manus-routes.json`.
- Run `npm run build` as the production check.
- Review source and diagnostics, fix actionable issues, then commit and push the intended files to the canonical `main` branch so the managed checkpoint records the delivered version.
