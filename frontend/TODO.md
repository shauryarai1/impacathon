# LIFELINE TODO

## Refinement pass

- [x] Keep the resident landing page focused on one primary action: Request Help. Move coordinator access to an accessible footer link that opens a dedicated login screen.
- [x] Gate the coordinator workspace behind a local preview access check, provide sign-out, and document that live authentication must use the backend contract.
- [x] Add a For Organizations page from the public footer. Explain the free resident/volunteer model, proposed B2G/B2NGO services, and an honest contact placeholder without billing, donations, ads, or checkout.
- [x] Add a Submitted column to Requests, sort newest first, show local date/time plus relative time, and show the exact submission time in the request detail panel.
- [x] Keep timestamp handling timezone-safe and backend-owned. When the timestamp is absent, state that clearly instead of inventing a live value. The demo fixture uses fixed timestamps only for formatter review.
- [x] Add a resident confirmation note identifying the missing backend timestamp in demo mode.
- [x] Prevent repeated resident submissions with a short submitting state and disabled button. Keep required field validation explicit.
- [x] Make previously inert overflow controls report their backend-dependent availability. Keep route manifest synchronized with the new pages.
- [x] Run the production build and document the exact local/manual integration boundaries.

## Open backend dependencies

- [ ] Replace the documented API placeholders with exact paths, headers, payload schemas, and response envelopes from `frontend-integration.md` or the FastAPI OpenAPI specification when supplied.
- [ ] Map the real request submission timestamp field and coordinator authentication/session flow from the backend contract. Preserve the current human-approval safety boundary during integration.
