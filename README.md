# Bike Buddy

Bike Buddy is a motorbike rental platform for Kathmandu, Lalitpur and
Bhaktapur, built for the ST6012CEM User Experience Design coursework. It
addresses manual, confusing and hard-to-trust rentals with verified-owner
signals, clear prices, availability checks and trackable support tickets.

The product is designed around Nielsen's ten usability heuristics and core UX
laws. Features trace back to the proposal, research pain points, user stories,
sprint backlog and interface prototypes.

## Repository

| Folder             | Purpose                                                                   |
| ------------------ | ------------------------------------------------------------------------- |
| `backend/`         | Express, TypeScript and MongoDB REST API                                  |
| `frontend/mobile/` | Flutter renter app using Riverpod and go_router                           |
| `frontend/web/`    | Next.js admin/owner portal using shadcn `base-nova`, Base UI and Tailwind |

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
- Durable in-app notification history with foreground live updates, unread
  state and reconnect replay
- Light, dark and system themes

**Owner/admin web portal**

- HttpOnly cookie authentication, owner registration, password recovery,
  profile management and role guards
- Admin dashboard, owner verification, bike moderation, booking overview and
  support workflow
- Owner fleet dashboard, listing form, booking/cash reconciliation and damage
  acknowledgement
- Local multi-image galleries with previous/next, thumbnail and full-screen
  controls; portable upload paths work in both the portal and Flutter app
- Consistent three-dot row action menus, contextual confirmation dialogs and a
  profile popover for predictable management workflows
- Live notification bell, severity-aware Sonner feedback and a responsive
  notification history for both portal roles
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
`PAYMENT_MODE=sandbox` runs the genuine eSewa UAT and Khalti sandbox checkouts —
still test-only, still no money — and needs `PAYMENT_PUBLIC_BASE_URL` plus
`PAYMENT_ALLOW_LOCAL_CALLBACK=true` when the backend is on this computer's LAN.
See [docs/PAYMENT_SANDBOX.md](docs/PAYMENT_SANDBOX.md) for the full setup.
Keep `HOST=0.0.0.0` for local mobile development so the API accepts requests
from Android emulators and phones on the same network. On startup, the backend
prints the localhost, Android-emulator and detected LAN values that can be used
as `API_BASE_URL`; it never prints credentials. If a phone cannot open
`<printed-LAN-origin>/health`, confirm that both devices share Wi-Fi and that
the operating-system firewall allows Node.js on private networks.

Owners upload bike photos through the portal. Multer stores them under
`backend/uploads/`, split by purpose:

| Folder              | Holds                                  |
| ------------------- | -------------------------------------- |
| `uploads/bike/`     | Listing photos uploaded by owners      |
| `uploads/profile/`  | Profile pictures                       |
| `uploads/kyc/`      | Renter ID documents                    |
| `uploads/evidence/` | Checklist, support and damage evidence |

MongoDB stores portable paths such as `/uploads/bike/<filename>` rather than a
developer-specific host name. Public bike/profile files are served by Express;
KYC and evidence paths use authenticated `/api/v1/uploads/...` routes with
role/ownership checks. The web and Flutter clients resolve both forms against
their configured API origin.

Runtime uploads are ignored by Git. The exception is a curated demonstration
set: licensed local motorcycle photos plus clearly stamped synthetic profile,
KYC and evidence fixtures. See the
[demo media attribution](docs/DEMO_MEDIA_ATTRIBUTION.md) for sources and
licenses. Re-running or editing demo accounts cannot delete those versioned
fixtures.

If `GMAIL_USER` and `GMAIL_APP_PASSWORD` are left blank outside production,
sign-in and password-reset codes are printed to the backend terminal instead of
being emailed, so the OTP and recovery journeys can still be demonstrated
locally. In production a missing mail configuration remains a hard failure.

The seed is repeatable and scoped to Bike Buddy demo accounts and their linked
records. It marks accounts it creates, refuses to overwrite matching unmarked
accounts, and removes only tagged demo bikes and their linked workflow data.
It prepares 17 accounts, 22 bikes, 28 bookings, 21 payments, 12 reviews, 12
support tickets, 5 damage reports, 4 SOS records and 7 durable notifications.

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
```

From the repository root, use the launcher that matches the target. It health
checks the backend, selects exactly one matching Android target, and supplies
the correct compile-time API origin:

```powershell
# Start an Android emulator first, then:
.\scripts\run-mobile-android.ps1 -Mode emulator

# Connect one Android phone with USB debugging enabled, then:
.\scripts\run-mobile-android.ps1 -Mode physical-usb

# Or, with the phone on the same Wi-Fi as this computer:
.\scripts\run-mobile-android.ps1 -Mode physical-wifi
```

The USB command creates a serial-specific ADB reverse and sends the app to
`http://127.0.0.1:5050`. The emulator command sends it to Android's host alias,
`http://10.0.2.2:5050`. The Wi-Fi command detects this computer's LAN address
from the interface that owns the default route — virtual WSL, VMware and
VirtualBox adapters are skipped because a phone cannot reach them — then
verifies the backend answers on that address before launching. Pass
`-LanAddress <ip>` to override the detection. If multiple matching devices are
connected, pass `-DeviceId <serial>` from `adb devices`; the script refuses to
guess.

The same named debug configurations and run tasks are available when VS Code
is opened at either the repository root or `frontend/mobile`. For the physical
USB debug configuration, select the phone in Flutter's VS Code device picker
before pressing F5. The pre-launch task verifies the backend and installs the
ADB reverse for the one connected physical device. Wi-Fi has no pre-launch
task, because a launch profile cannot receive a detected address — run the
"Bike Buddy: run physical Android (Wi-Fi)" task instead, or use the launch
profile that relies on the checked-in host constant described below.

### Host selection when no launcher is used

A plain `flutter run -d <phone-serial>` passes no `--dart-define`, so the app
falls back to the constants at the top of `lib/core/api/api_endpoints.dart`:

```dart
static const bool isPhysicalDevice = true;
static const String physicalDeviceHost = '192.168.1.73';
```

With `isPhysicalDevice` set, Android and iOS builds default to
`http://<physicalDeviceHost>:5050`. That address also works from an emulator,
so one build runs on either target. Update `physicalDeviceHost` when this
computer's Wi-Fi address changes; the backend prints the current value on
startup. Set `isPhysicalDevice` to `false` to go back to the emulator alias
`http://10.0.2.2:5050`.

`--dart-define=API_BASE_URL` always overrides both, so the launcher scripts and
debug profiles never depend on the constant being current:

```powershell
cd frontend/mobile
flutter run -d <phone-serial> --dart-define=API_BASE_URL=http://<current-ip>:5050
```

The phone and computer must be on the same network and Windows Firewall must
allow Node.js on that network profile. `API_BASE_URL` is an origin only; never
append `/api/v1`. Stop and relaunch after changing it or the constants, because
Dart defines and `const` values are compiled into the app.

Local plain HTTP is development-only. Android debug builds allow it for the
emulator/ADB workflow, while Android release builds require HTTPS. iOS includes
only the scoped local-network development entitlement and permission message;
use a reachable HTTPS backend for a physical iPhone and for every production
build.

Use a stable Android 15/API 35 or Android 16/API 36 Google APIs x86_64 image for
coursework testing. Avoid preview/canary API 37 and specialised 16 KB/AI image
variants while diagnosing so they do not add unrelated emulator variables.
Cold-boot or recreate the AVD if the whole emulator, ADB shell, or System UI
stalls; that is a system-level stall. A Bike Buddy Dart crash will instead
appear as `E/flutter` or `FATAL EXCEPTION` in logcat.

The demo map uses OpenStreetMap tiles and needs no API key. Google OAuth is
renter-only and still requires the normal Android/web client configuration;
email/password remains available for an offline coursework recording.

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
[live notification guide](docs/LIVE_NOTIFICATIONS.md) documents the manual
MongoDB/SSE implementation and its foreground-only boundary. The
[video demonstration runbook](docs/DEMO_VIDEO_RUNBOOK.md) provides the
recording sequence, demo values and speaking script.

## Author

Subham Adhikari · 14812262 · Softwarica College of IT and E-Commerce /
Coventry University
