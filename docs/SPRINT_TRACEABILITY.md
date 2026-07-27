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
| 2 — discovery and trust | Renters cannot easily judge condition, availability, location or owner credibility. | Guest browse; validated search/filter/date queries; overlap-aware availability; map/list discovery; comparison capped at three; bike details, dated evidence, review summaries and verified-owner/bike signals; owner-scoped bike management. |
| 3 — booking and payment | Manual pricing creates hidden-fee anxiety and booking errors. | Server-calculated quote and locked itemised totals; availability recheck; booking access control; explicit demo-wallet boundary; server-owned payment amount/reference; PDF receipt after successful record; clear success/failure recovery. |
| 4 — safety, handover and return | Riders and owners need shared condition evidence and honest emergency boundaries. | Mandatory safety checklist and photo evidence; renter-owned active-ride controls; authorised SOS recording with emergency-service guidance; return preview, grace-period calculation, extension conflict checks and owner-scoped damage acknowledgement. |
| 5 — polish, support and accessibility | Users need flexible booking changes, cash handling, visible support state and an inclusive portal. | Reschedule/cancellation preview; cash-at-pickup selection and owner receipt reconciliation; strict support priority/status workflow; responsive shadcn/Base UI portal; owner registration/recovery/profile; dark mode, skip link, keyboard focus, status/error feedback and reduced motion. |

## Security and truthfulness decisions

- Wallet payment is a coursework simulation. No UI claims that money was
  charged, transferred or refunded.
- Cash becomes paid only after the owner records receipt; only then can a
  receipt be generated.
- Paid live/cash cancellation is blocked until a verified refund workflow
  exists.
- SOS records an alert in Bike Buddy. It does not claim to dispatch responders.
- Support has priority and visible state, but no fabricated response-time or
  round-the-clock staffing promise.
- Account deletion removes access/profile data after active-work checks.
  Historical booking/payment records may remain for record integrity.

## Known coursework boundaries

Production requires real MongoDB, email, Google OAuth and media-storage
configuration. A live payment provider, cash-refund operation, staffed chat,
notification delivery and emergency dispatch integration are deliberately not
simulated as real services.
