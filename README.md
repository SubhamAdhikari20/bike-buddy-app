# Bike Buddy

Bike Buddy is a motorbike rental platform for Nepal (Kathmandu, Lalitpur, Bhaktapur), built for the ST6012CEM User Experience Design coursework. Renting a bike here is manual, confusing and hard to trust - Bike Buddy fixes that with verified owners, clear prices, live availability and 24/7 support.

The whole product is designed around Nielsen's 10 usability heuristics and core UX laws (Fitts's, Hick's, Jakob's, Miller's, proximity, cognitive load). Every screen traces back to a user story from the research phase (57 stories across 5 sprints).

## What's in this repo

| Folder | What it is |
|---|---|
| `backend/` | Node.js + Express + TypeScript REST API with MongoDB (Mongoose) |
| `frontend/mobile/` | Flutter app for renters and owners (Riverpod, go_router, clean architecture) |
| `frontend/web/` | Next.js portal for admins and owners (shadcn/ui on base-ui, Tailwind) |

## Main features

**Mobile app (renters)**
- Guest browsing - sign-up is only asked at booking time
- 3-step onboarding, OTP sign-in, one-time ID verification with a clear data-use note
- Search with filters, category chips, list/map toggle and side-by-side bike comparison
- Bike detail with verified owner badge, dated photo gallery, specs, damage policy and real reviews (verified rides only, 1-star never blocked)
- 3-step booking with a live fare estimate, itemised breakdown, price lock and no hidden fees
- eSewa / Khalti (sandbox) and cash-at-pickup payments, PDF receipts
- Pre-ride handover checklist with photo evidence, active ride screen with an always-visible SOS button
- Step-by-step return with late-fee preview, extend-by-an-hour and damage reports
- 24/7 support: phone, chat, searchable FAQ, photo tickets with status tracking
- Dark mode (system / light / dark)

**Web portal**
- Admin: dashboard, owner verification, bike suspension, bookings, support ticket queue
- Owner: fleet dashboard, list a new bike, confirm/complete bookings, damage reports

## Getting started

### Backend

```bash
cd backend
npm install
cp .env.sample .env   # fill in MONGODB_URI, JWT_SECRET, GMAIL_USER, GMAIL_APP_PASSWORD
npm run seed          # demo admin, owners, renters and Kathmandu bikes
npm run dev           # http://localhost:5050
```

Seeded logins (password `Password@123`):
- Admin: `admin@bikebuddy.com`
- Owner: `ramesh.owner@bikebuddy.com` (verified), `sita.owner@bikebuddy.com` (pending)
- Renter: `aashish@student.com` (KYC approved), `maya@student.com`

### Mobile app

```bash
cd frontend/mobile
flutter pub get
flutter run
```

Notes:
- The API base URL is `http://10.0.2.2:5050` (Android emulator). Change it in `lib/core/constants/app_constants.dart` for a physical device.
- Add your Google Maps key in `android/app/src/main/AndroidManifest.xml` to see the map tiles.

### Web portal

```bash
cd frontend/web
npm install
npm run dev           # http://localhost:3000
```

Set `NEXT_PUBLIC_API_URL=http://localhost:5050/api/v1` in `frontend/web/.env`.

## Branches

Work happened sprint by sprint: `sprint-1` (foundation and onboarding), `sprint-2` (discovery, trust and maps), `sprint-3` (booking and payment), `sprint-4` (condition, return and emergency), `sprint-5` (polish, accessibility and the web portal). Each sprint merged into `main` when done.

## Author

Subham Adhikari · 14812262 · Softwarica College of IT and E-Commerce / Coventry University
