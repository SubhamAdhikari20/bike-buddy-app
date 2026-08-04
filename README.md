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

Only the database runs in a container. The backend, web portal and mobile app
are started normally with `npm run dev` and `flutter run`.

### 1. MongoDB

With Docker Desktop running, from the repository root:

```bash
docker compose up -d
```

That starts a single `bike-buddy-mongo` container on `127.0.0.1:27017` and
keeps its data in the named volume `bike-buddy-mongo-data`, so demo data
survives a restart. Useful commands:

```bash
docker compose ps        # check it is up
docker compose logs -f   # follow the database log
docker compose down      # stop it, keep the data
docker compose down -v   # stop it and delete the data
```

No Docker? Install MongoDB Community Server and either run
`Start-Service MongoDB` as administrator, or start it yourself against a folder
you own:

```powershell
mkdir C:\Users\<you>\mongodb-data\bike-buddy
& "C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe" --dbpath C:\Users\<you>\mongodb-data\bike-buddy
```

Either way the connection string is the same and the database is created on
first write.

### 2. Backend

```bash
cd backend
npm install
cp .env.sample .env
npm run seed
npm run dev
```

Set `MONGODB_URI=mongodb://127.0.0.1:27017/bike-buddy` in `.env` — the same
value whether MongoDB is running in Docker or natively.
`PAYMENT_MODE=demo` is the safe coursework default and never moves money.

Owners upload bike photos through the portal. Multer stores them under
`backend/uploads/`, split by purpose:

| Folder | Holds |
|---|---|
| `uploads/bike/` | Listing photos uploaded by owners |
| `uploads/profile/` | Profile pictures |
| `uploads/kyc/` | Renter ID documents |

Express serves the folder at `/uploads`, so a stored file is reachable at
`http://localhost:5050/uploads/bike/<filename>`. Uploaded files are ignored by
git; only the folder placeholders are tracked.

If `GMAIL_USER` and `GMAIL_APP_PASSWORD` are left blank outside production,
sign-in and password-reset codes are printed to the backend terminal instead of
being emailed, so the OTP and recovery journeys can still be demonstrated
locally. In production a missing mail configuration remains a hard failure.

The seed is repeatable and scoped to Bike Buddy demo accounts and their linked
records. It marks accounts it creates, refuses to overwrite matching unmarked
accounts, and removes only tagged demo bikes and their linked workflow data.
It prepares 17 accounts, 22 bikes, 28 bookings, 21 payments, 12 reviews, 12
support tickets, 5 damage reports and 4 SOS records.

Seed password: `Password@123`

- Admin: `admin@bikebuddy.com`
- Owners: `ramesh.owner@bikebuddy.com` (verified),
  `bimal.owner@bikebuddy.com` (verified), `sita.owner@bikebuddy.com` (pending),
  `anjali.owner@bikebuddy.com` (rejected)
- Renters: `aashish@student.com`, `maya@student.com`,
  `saroj@student.com`, `nishant@student.com`, `binita@student.com`,
  `krish@student.com`, `mohammad@student.com`, `dipesh@student.com`,
  `pratima@student.com`, `sujan@student.com`, `anita@student.com`,
  `roshan@student.com`

With the backend running, `npm run demo:verify` performs a disposable
owner-scoped bike create, read, update and delete check. The prepared demo
fleet is left unchanged.

### 3. Mobile

```bash
cd frontend/mobile
flutter pub get
flutter run
```

The API base URL is chosen per platform when none is supplied: an Android
emulator uses `http://10.0.2.2:5050` and Windows, web, iOS simulator, macOS and
Linux builds use `http://localhost:5050`. A physical phone needs the host
machine's LAN IP:

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.20:5050
```

Supply Maps and Google OAuth platform configuration for those integrations.

### 4. Web

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
[video demonstration runbook](docs/DEMO_VIDEO_RUNBOOK.md) provides the
recording sequence, demo values and speaking script.

## Author

Subham Adhikari · 14812262 · Softwarica College of IT and E-Commerce /
Coventry University
