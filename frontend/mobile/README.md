# Bike Buddy mobile app

Flutter customer application for Bike Buddy. Owners and administrators use the
web portal; Google sign-in is intentionally available only to renters.

## Local setup

1. Copy `backend/.env.sample` to `backend/.env` and configure MongoDB, JWT and
   email values.
2. Add the Android and iOS applications to the same Google OAuth project as the
   backend web client. Register the Android package name and signing
   certificate fingerprints.
3. Add the platform configuration files required by Google:
   `android/app/google-services.json` and `ios/Runner/GoogleService-Info.plist`.
   Do not commit files that contain environment-specific credentials.
4. Run the backend, then start Flutter with the API and OAuth client IDs:

   ```powershell
   flutter pub get
   flutter run `
     --dart-define=API_BASE_URL=http://10.0.2.2:5050 `
     --dart-define=GOOGLE_SERVER_CLIENT_ID=YOUR_WEB_CLIENT_ID `
     --dart-define=GOOGLE_PLATFORM_CLIENT_ID=YOUR_PLATFORM_CLIENT_ID
   ```

`GOOGLE_SERVER_CLIENT_ID` must also be present in the backend
`GOOGLE_CLIENT_IDS` allow-list. `GOOGLE_PLATFORM_CLIENT_ID` is optional when the
platform configuration already supplies it.

The Android emulator reaches the host machine through `10.0.2.2`. A physical
device needs a reachable development address. Release builds disable cleartext
HTTP, so set `API_BASE_URL` to an HTTPS endpoint.

## Authentication behaviour

- Email/password registration and Google sign-in create renter accounts.
- Password recovery sends a six-digit, single-use code that expires after
  15 minutes. The API always returns the same request message so an attacker
  cannot discover whether an email is registered.
- Session tokens are stored with Flutter secure storage and checked against
  `/auth/me` when the app starts.
- Public owner registration and all admin access belong to the web portal.

## Payment modes

`PAYMENT_MODE=demo` is the default backend setting for coursework testing.
Checkout, confirmation screens, and PDF receipts all state that it is a
simulation and no money is charged. The server calculates the amount from the
locked booking price and ignores client-controlled amounts or transaction
references.

`PAYMENT_MODE=live` intentionally rejects payment initiation until a verified
Khalti/eSewa server adapter and merchant credentials are implemented. Do not
replace the rejection with a fabricated provider URL.

## Support phone

Configure a real staffed line with `--dart-define=SUPPORT_PHONE=...`. When this
value is omitted, the app states that phone support is unavailable and never
displays a fabricated emergency number.

## Quality checks

```powershell
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
```
