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
9. Navigate the portal by keyboard at narrow and desktop widths in both themes.

Runtime integration needs configured MongoDB and email/OAuth credentials.
Automated schema/service tests do not claim external services are available.
