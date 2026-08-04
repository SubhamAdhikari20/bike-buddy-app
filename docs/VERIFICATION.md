# Verification guide

## Automated checks

Backend:

```bash
cd backend
npm install
npm run lint
npx tsc --noEmit
npm test
npm audit --omit=dev
```

Web portal:

```bash
cd frontend/web
npm install
npm run lint
npx tsc --noEmit
npm run build
npm audit
```

Flutter:

```bash
cd frontend/mobile
flutter pub get
dart format --output=none lib test
flutter analyze
flutter test
flutter build apk --debug
```

## Manual role journeys

1. Register an owner, sign out, reset the password, sign in and edit the profile.
2. As an admin, verify the owner. Confirm non-admins cannot open admin routes.
3. As that owner, add a bike and verify only that owner's bikes appear.
4. As a renter, search/compare, inspect trust evidence, book and review the
   server-generated price breakdown.
5. Complete an explicit demo-wallet journey; verify the receipt says no money
   moved.
6. Select cash for another booking. Verify no receipt exists until the correct
   owner records cash received.
7. Complete handover/return evidence; verify the owner can acknowledge—but not
   resolve—the damage report.
8. Submit a breakdown ticket. Verify server-derived priority and the admin
   transition `open → in review → resolved`, never backwards.
9. Keep the owner portal and renter app open. Create and approve a booking;
   verify each recipient sees only their own live update, unread state survives
   refresh, and a reconnect silently replays anything missed.
10. Navigate the portal by keyboard at narrow and desktop widths in both
    themes.

Also confirm an unverified renter is directed to ID verification and the API
rejects booking creation until KYC is approved.

Runtime integration needs configured MongoDB and email/OAuth credentials.
Automated schema/service tests do not claim external services are available.
The notification check demonstrates foreground SSE with durable MongoDB replay,
not an operating-system push notification or background delivery service.

## Repeatable video demo

`npm run seed` is an idempotent demo setup. It registers missing demo
personas first, marks the accounts it creates, refuses to overwrite matching
unmarked accounts, and recreates only tagged bikes and their linked demo
workflow records. It does not clear unrelated Atlas collections.

Run `npm run demo:verify` while the backend is listening to prove owner-scoped
bike create, read, update and delete through the real HTTP API. See
[DEMO_VIDEO_RUNBOOK.md](DEMO_VIDEO_RUNBOOK.md) for the filming order and
speaking script.
