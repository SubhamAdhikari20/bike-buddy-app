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
4. Run the backend, then choose the address that matches the target device.
   The named VS Code launch configurations under `.vscode/launch.json` set
   this automatically.

   For a physical Android phone connected by USB, use the recommended
   `Bike Buddy: physical Android (USB)` configuration. Its pre-launch task
   maps the backend port with ADB and uses the device's loopback address, so
   no changing Wi-Fi IP is committed to the project. The equivalent commands
   are:

   ```powershell
   $adbPath = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
   & $adbPath reverse tcp:5050 tcp:5050
   flutter run --dart-define=API_BASE_URL=http://127.0.0.1:5050
   ```

   For an Android emulator, use `Bike Buddy: Android emulator` or run:

   ```powershell
   flutter pub get
   flutter run `
     --dart-define=API_BASE_URL=http://10.0.2.2:5050 `
     --dart-define=GOOGLE_SERVER_CLIENT_ID=YOUR_WEB_CLIENT_ID `
     --dart-define=GOOGLE_PLATFORM_CLIENT_ID=YOUR_PLATFORM_CLIENT_ID
   ```

   A phone connected over Wi-Fi instead of USB must use the computer's
   reachable LAN address, for example
   `--dart-define=API_BASE_URL=http://192.168.1.20:5050`. The phone and
   computer must be on the same network and the firewall must allow port
   5050. The **Bike Buddy: physical phone (LAN / HTTPS)** launch configuration
   prompts for this origin, so no Dart source needs editing. Stop and relaunch
   after changing it; hot reload cannot change compile-time values.

`GOOGLE_SERVER_CLIENT_ID` must also be present in the backend
`GOOGLE_CLIENT_IDS` allow-list. `GOOGLE_PLATFORM_CLIENT_ID` is optional when the
platform configuration already supplies it.

The Android emulator reaches the host machine through `10.0.2.2`; that address
does not work on a physical phone. Release builds disable cleartext HTTP, so
set `API_BASE_URL` to an HTTPS endpoint for a release build. Use HTTPS for a
physical iPhone as well, because iOS App Transport Security can reject a local
plain-HTTP address.

## API endpoint management

`lib/core/api/api_endpoints.dart` is the single source of truth for the server
origin, `/api/v1` base, timeouts, uploads, notification stream, and every
feature endpoint. Feature API classes use those constants/builders instead of
repeating path strings. `API_BASE_URL` must contain only the server origin
(for example `http://192.168.1.20:5050`), not `/api/v1`; invalid values fail
early with an actionable configuration error.

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
