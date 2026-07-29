# Bike Buddy

Bike Buddy is a motorbike rental platform for Kathmandu, Lalitpur and
Bhaktapur, built for the ST6012CEM User Experience Design coursework. It
addresses manual, confusing and hard-to-trust rentals with verified-owner
signals, clear prices, availability checks and trackable support tickets.

The product is designed around Nielsen's ten usability heuristics and core UX
laws. Features trace back to the proposal, research pain points, user stories,
sprint backlog and interface prototypes.

## Repository

| Folder | Purpose |
|---|---|
| `backend/` | Express, TypeScript and MongoDB REST API |
| `frontend/mobile/` | Flutter renter app using Riverpod and go_router |
| `frontend/web/` | Next.js admin/owner portal using shadcn `base-nova`, Base UI and Tailwind |

## Product capabilities

**Renter mobile app**

- Guest discovery, filters, map/list views and comparison of up to three bikes
- Register/login, OTP, password recovery, renter-only Google authentication,
  secure session restore and profile/privacy controls
- Condition evidence, verified-owner signals, specifications and real review
  summaries
- Server-generated quotes, itemised locked totals and availability rechecks
- Clearly labelled coursework wallet simulation, cash-at-pickup reconciliation
  and PDF receipts after payment is recorded
- Handover checklist, active ride, SOS recording, return preview, extension and
  damage reporting
- Configurable support phone, searchable FAQ and photo tickets with honest
  status tracking; chat is explicitly a preview
- Light, dark and system themes

**Owner/admin web portal**

- HttpOnly cookie authentication, owner registration, password recovery,
  profile management and role guards
- Admin dashboard, owner verification, bike moderation, booking overview and
  support workflow
- Owner fleet dashboard, listing form, booking/cash reconciliation and damage
  acknowledgement
- Responsive navigation, keyboard focus, skip link, reduced-motion support and
  light/dark themes

## Getting started

### Backend

```bash
cd backend
npm install
cp .env.sample .env
npm run seed
npm run dev
```

Configure MongoDB, JWT and email settings before using related workflows.
`PAYMENT_MODE=demo` is the safe coursework default and never moves money.

The seed is repeatable and scoped to Bike Buddy demo accounts and their linked
records. It marks accounts it creates, refuses to overwrite matching unmarked
accounts, and removes only tagged demo bikes and their linked workflow data.

Seed password: `Password@123`

- Admin: `admin@bikebuddy.com`
- Owners: `ramesh.owner@bikebuddy.com`, `sita.owner@bikebuddy.com`
- Renters: `aashish@student.com`, `maya@student.com`,
  `saroj@student.com`, `nishant@student.com`, `binita@student.com`,
  `krish@student.com`, `mohammad@student.com`, `dipesh@student.com`

With the backend running, `npm run demo:verify` performs a disposable
owner-scoped bike create, read, update and delete check. The prepared demo
fleet is left unchanged.

### Mobile

```bash
cd frontend/mobile
flutter pub get
flutter run
```

The Android emulator API default is `http://10.0.2.2:5050`. Supply Maps and
Google OAuth platform configuration for those integrations.

### Web

```bash
cd frontend/web
npm install
cp .env.sample .env.local
npm run dev
```

Set backend `CORS_ORIGIN` to the exact portal origin.

## Sprints and documentation

Work is separated into `sprint-1` through `sprint-5`, then integrated into
`main`:

1. foundation and authentication;
2. discovery, trust and maps;
3. booking and payment;
4. condition, return and safety;
5. polish, accessibility, support and portal workflows.

See [sprint traceability](docs/SPRINT_TRACEABILITY.md),
[UX heuristic audit](docs/UX_HEURISTIC_AUDIT.md) and
[verification guide](docs/VERIFICATION.md). The
[video demonstration runbook](docs/DEMO_VIDEO_RUNBOOK.md) provides a
12-16 minute recording sequence, demo values and speaking script.

## Author

Subham Adhikari · 14812262 · Softwarica College of IT and E-Commerce /
Coventry University
