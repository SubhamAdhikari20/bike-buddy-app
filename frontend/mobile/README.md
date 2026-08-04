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
4. Run the backend, then launch with the repository helper. Do not edit
   `api_endpoints.dart` and do not add or toggle an `isPhysicalDevice` boolean.
   From the repository root:

   ```powershell
   # Start one emulator first.
   .\scripts\run-mobile-android.ps1 -Mode emulator

   # Or connect one trusted USB-debugging phone.
   .\scripts\run-mobile-android.ps1 -Mode physical-usb
   ```

   The helper verifies the host backend health endpoint before Flutter starts.
   Emulator mode selects exactly one `emulator-*` serial and compiles
   `http://10.0.2.2:5050` into the app. Physical USB mode selects exactly one
   non-emulator serial, installs `adb -s <serial> reverse tcp:5050 tcp:5050`,
   verifies that rule, and compiles `http://127.0.0.1:5050`. With more than one
   target, pass `-DeviceId <serial>` so the script never guesses.

   VS Code exposes the same debug configurations and run tasks whether the
   repository root or this mobile folder is open. Select the physical phone in
   Flutter's status-bar device picker before using the physical USB F5 config.

   For a physical Android phone over Wi-Fi, get the computer's current address
   at launch time:

   ```powershell
   Get-NetIPConfiguration |
     Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
     ForEach-Object { $_.IPv4Address.IPAddress }

   flutter run -d <phone-serial> `
     --dart-define=API_BASE_URL=http://<current-ip>:5050
   ```

   Never store the current DHCP address as a source-code constant. The phone
   and computer must share a network, and Windows Firewall must allow the Node
   backend on that profile. `API_BASE_URL` contains only the origin, never
   `/api/v1`. Stop and relaunch when it changes; hot reload cannot replace a
   compile-time Dart define.

`GOOGLE_SERVER_CLIENT_ID` must also be present in the backend
`GOOGLE_CLIENT_IDS` allow-list. `GOOGLE_PLATFORM_CLIENT_ID` is optional when the
platform configuration already supplies it.

The Android emulator reaches the host machine through `10.0.2.2`; that address
does not work on a physical phone. Plain HTTP is enabled only for Android local
debugging. Release builds require an HTTPS `API_BASE_URL`. iOS has a scoped
local-network usage description and `NSAllowsLocalNetworking` for development,
but a physical iPhone and all production builds should use a reachable HTTPS
backend; the setting does not permit arbitrary insecure Internet traffic.

Prefer a stable Android 15/API 35 or Android 16/API 36 Google APIs x86_64 AVD.
Avoid preview/canary API 37 and specialised 16 KB/AI image variants while
diagnosing so they do not add unrelated emulator variables. If System UI and
`adb shell` also freeze, cold-boot or recreate the AVD; that is a system-level
stall. An application crash will have an `E/flutter` or `FATAL EXCEPTION`
entry in logcat.

## API endpoint management

`lib/core/api/api_endpoints.dart` is the single source of truth for the server
origin, `/api/v1` base, timeouts, uploads, notification stream, and every
feature endpoint. Feature API classes use those constants/builders instead of
repeating path strings. `API_BASE_URL` must contain only the server origin
(for example `http://<current-ip>:5050`), not `/api/v1`; invalid values fail
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
