# Sprint traceability

This implementation was checked against the proposal, coursework brief, sprint
backlog, user stories, pain-point sheets, UI prototypes and the separate
`bike-buddy-demo` reference. The demo informed visual direction only; security
and workflow claims in this repository are tied to implemented behaviour.

## Research themes

The source material repeatedly prioritises bike condition, transparent price,
availability, verified owners, low-effort booking and support/safety. The three
actors are kept distinct:

- renters/customers discover and book in the Flutter app;
- owners manage their fleet, handovers and cash acknowledgement in the web
  portal;
- administrators verify owners and moderate platform workflows in the portal.

Google sign-in is intentionally renter-only. The owner/admin portal offers
email/password authentication and owner registration without presenting a
misleading Google option.

## Delivery by sprint

| Sprint | User need and pain point | Delivered evidence |
|---|---|---|
| 1 — foundation and authentication | People need understandable onboarding and recoverable, role-correct access. | Strict auth schemas; password strength and hashing; HttpOnly web cookie; mobile secure token storage/session restore; register/login/logout; OTP and forgot/reset password; renter-only Google ID-token verification; profile editing and guarded account deletion. |
| 2 — discovery and trust | Renters cannot easily judge condition, availability, location or owner credibility. | Guest browse; validated search/filter/date queries; overlap-aware availability; OpenStreetMap map/list discovery; comparison capped at three; responsive details, dated evidence, review summaries and verified-owner/bike signals; owner-scoped bike management. |
| 3 — booking and payment | Manual pricing creates hidden-fee anxiety and booking errors. | Server-calculated and locked itemised totals; per-bike reservation lease and expiring unpaid hold; provider-hosted eSewa UAT/Khalti sandbox checkout; authoritative amount/reference/status verification; owner approval kept separate from payment; test-labelled PDF receipt and clear recovery. |
| 4 — safety, return and live state | Riders and owners need shared condition evidence, honest emergency boundaries and timely workflow feedback. | Mandatory safety checklist and photo evidence; renter-owned active-ride controls; authorised SOS recording with emergency-service guidance; return preview, grace-period calculation and owner-scoped damage acknowledgement; durable recipient-scoped Mongo inbox with authenticated foreground SSE, replay and unread state for all roles. |
| 5 — polish, support and accessibility | Users need flexible booking changes, cash handling, visible support state and an inclusive portal. | Reschedule/cancellation preview; cash-at-pickup selection and owner receipt reconciliation; strict support priority/status workflow; responsive shadcn/Base UI portal; owner registration/recovery/profile; dark mode, skip link, keyboard focus, status/error feedback and reduced motion. |

## Owner portal stories

The research workbook focuses mainly on renter stories. These owner stories make
the portal acceptance criteria explicit without changing those source records.

| Story | Sprint | Acceptance evidence |
|---|---|---|
| OWN-01 Register and manage an owner profile | 1 | Owner registration creates a pending profile; login, recovery and profile editing are role guarded. |
| OWN-02 Manage only my fleet | 2 | A verified owner can create, read, fully edit, change status and delete an unbooked bike. Cross-owner access is rejected, and bikes with booking history must be made inactive instead of deleted. |
| OWN-03 Manage bookings and cash | 3 | The owner sees only related bookings and can record cash receipt before a receipt becomes available. |
| OWN-04 Record handover and damage state | 4 | Handover evidence is preserved and an owner may acknowledge a damage report without claiming resolution. |
| OWN-05 Use an accessible, predictable portal | 5 | Responsive navigation, keyboard focus, empty/loading/error states, confirmation before deletion and light/dark themes are implemented. |

## Security and truthfulness decisions

- A renter must have an approved ID-verification profile before the server
  creates a booking; the mobile app explains pending and unverified states.
- Owners cannot set bike verification, safety score or inspection notes.
  Those moderation fields remain administrator controlled.
- Wallet payment is demo or provider sandbox/UAT only. No UI claims that test
  money was charged, transferred or refunded, and `live` mode fails closed.
- Cash becomes paid only after the owner records receipt; only then can a
  receipt be generated.
- Paid live/cash cancellation is blocked until a verified refund workflow
  exists.
- Live notifications are an in-app foreground SSE inbox with durable replay;
  they are not operating-system push, SMS or a hosted delivery guarantee.
- SOS records an alert in Bike Buddy. It does not claim to dispatch responders.
- Support has priority and visible state, but no fabricated response-time or
  round-the-clock staffing promise.
- Account deletion removes access/profile data after active-work checks.
  Historical booking/payment records may remain for record integrity.

## Known coursework boundaries

Production requires managed deployment, email, Google OAuth and media-storage
configuration. Live wallet charging, cash/provider refund operations, staffed
chat, operating-system notification push, multi-instance instant SSE fan-out
and emergency dispatch integration are deliberately not presented as complete
production services.
