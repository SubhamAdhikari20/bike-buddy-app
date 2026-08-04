# Payment sandbox guide

Bike Buddy supports coursework-safe wallet testing through provider-hosted
eSewa UAT and Khalti sandbox checkout pages. The Flutter app does not embed a
wallet SDK or WebView. It opens the checkout in the device's external browser,
then asks the authenticated Bike Buddy backend for the verified result.

This is a test integration only. Do not use real wallet credentials or describe
the flow as a live payment.

Official references:

- [eSewa ePay integration and status check](https://developer.esewa.com.np/pages/Epay)
- [eSewa test credentials](https://developer.esewa.com.np/pages/Test-credentials)
- [Khalti Web Checkout, sandbox access and lookup](https://docs.khalti.com/khalti-epayment/)

## Payment modes

`PAYMENT_MODE` is controlled by the backend, not by Flutter.

| Mode      | Behaviour                                                                                                                         | Use                                   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `demo`    | Runs Bike Buddy's clearly labelled local success/failure simulation. It does not contact eSewa or Khalti and cannot charge money. | Default and safest video-demo mode.   |
| `sandbox` | Creates a hosted test checkout using eSewa UAT or Khalti sandbox. Provider secrets and verification remain on the backend.        | Optional end-to-end provider testing. |
| `live`    | Rejects wallet initiation. Production endpoints and live charging are deliberately not implemented.                               | Fail-closed guard only.               |

Changing a mobile label, callback query parameter or database field cannot
turn a test flow into a live flow. Live mode requires a separate production
readiness and merchant review outside this coursework project.

## Architecture and trust boundary

1. An authenticated renter creates a booking and selects eSewa or Khalti.
2. The backend reloads that booking, checks renter ownership and allowed booking
   state, and uses the server-owned locked NPR total. The client cannot supply a
   trusted payment amount.
3. In `demo` mode, the backend creates a demo attempt and the app presents an
   explicit local success/failure control.
4. In `sandbox` mode:
   - Khalti initiation is a server-to-server request. Khalti returns a `pidx`
     and hosted `payment_url`.
   - eSewa requires an HTML form POST. Bike Buddy returns a one-use,
     server-signed bridge URL that expires after five minutes; opening it
     renders an auto-submitting form for the official eSewa UAT endpoint.
5. Flutter opens the returned URL with the system browser. Wallet login, MPIN
   and OTP are entered only on the provider-hosted test page. Bike Buddy neither
   asks for nor stores those credentials.
6. A provider redirect is treated only as a signal to verify. It is never proof
   that payment succeeded.
7. The backend validates the provider identity, transaction reference and exact
   amount. Only a verified successful provider status changes the payment to
   `succeeded` and the booking payment status to `paid`.
8. Payment and owner approval are separate states. A paid booking request stays
   pending until its owner accepts it; payment success does not approve a bike
   rental automatically.

An unpaid request holds its selected dates for a short, server-controlled
window (30 minutes by default). Checkout initiation, cash approval and payment
settlement all recheck that hold. Once it expires, the request cannot be revived
or allowed to conflict with a newer reservation; a late sandbox settlement is
flagged for reconciliation instead.

Pending attempts are reused for a booking, and state transitions are guarded so
two concurrent checks cannot grant the service twice.

## Backend environment

Copy `backend/.env.sample` to `backend/.env`. Keep the real `.env` file out of
Git. The payment variables are:

| Variable                          | Purpose                                                                                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PAYMENT_MODE`                    | `demo`, `sandbox` or fail-closed `live`.                                                                                                                        |
| `PAYMENT_PUBLIC_BASE_URL`         | Public HTTPS origin that reaches the backend, such as `https://random-name.example-tunnel.dev`. Supply an origin only: no path, query, fragment or credentials. |
| `PAYMENT_WEBSITE_URL`             | Public website origin sent to Khalti. For a local coursework test it may be the same stable HTTPS tunnel origin.                                                |
| `KHALTI_SANDBOX_SECRET_KEY`       | Sandbox merchant secret used only by the backend for Khalti initiate/lookup calls.                                                                              |
| `ESEWA_SANDBOX_SECRET_KEY`        | eSewa UAT merchant secret used only by the backend for request and callback signatures.                                                                         |
| `PAYMENT_CHECKOUT_SIGNING_SECRET` | Independent random secret of at least 32 characters for Bike Buddy's short-lived eSewa bridge links. Do not reuse a provider or JWT secret.                     |
| `PAYMENT_PROVIDER_TIMEOUT_MS`     | Provider request timeout. Default `8000`; accepted range `1000` to `15000`.                                                                                     |
| `PAYMENT_LOOKUP_INTERVAL_MS`      | Minimum server-side provider lookup interval. Default `15000`; accepted range `5000` to `60000`.                                                                |
| `BOOKING_HOLD_MINUTES`            | Minutes an unpaid request reserves its dates. Default `30`; accepted range `5` to `60`.                                                                         |

Generate the independent bridge secret locally, for example:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Paste its output only into `PAYMENT_CHECKOUT_SIGNING_SECRET` in the untracked
backend `.env`. Provider secrets must never appear in Flutter `--dart-define`
values, web environment files, screenshots, logs, commits or demo narration.

### Why the HTTPS tunnel is required

`localhost`, `127.0.0.1` and Android emulator host aliases are local to the
machine or device using them. The provider-hosted browser flow cannot reliably
return to a loopback address on the development computer. Start a public HTTPS
tunnel to `http://localhost:5050`, keep the same tunnel URL for the entire
transaction, and set its origin as `PAYMENT_PUBLIC_BASE_URL` before starting the
backend.

The tunnel exposes a callback surface. Use a temporary URL, expose only the Bike
Buddy backend, do not expose MongoDB, and stop the tunnel after testing.

## Start a sandbox session

1. Start MongoDB using the repository's normal setup.
2. Start a public HTTPS tunnel that forwards to backend port `5050`.
3. Put the stable tunnel origin and the required provider secret in
   `backend/.env`. Set `PAYMENT_MODE=sandbox` and create a fresh
   `PAYMENT_CHECKOUT_SIGNING_SECRET`.
4. Start the backend after the environment is saved:

   ```powershell
   cd backend
   npm install
   npm run dev
   ```

5. Start Flutter with an API address the device can reach. An Android emulator
   normally uses Bike Buddy's default `http://10.0.2.2:5050`; a physical phone
   needs the development computer's LAN address:

   ```powershell
   cd frontend/mobile
   flutter pub get
   flutter run --dart-define=API_BASE_URL=http://192.168.1.20:5050
   ```

6. Sign in as an approved renter, choose an available bike, select valid dates,
   review the locked price, and choose the sandbox wallet.
7. Use **Open payment page**, finish the provider's test journey in the external
   browser, return to Bike Buddy, and use **Check payment status** if automatic
   verification is still pending.

Do not change payment mode, secrets, tunnel origin or database while an attempt
is pending. Restart with a fresh booking attempt after changing configuration.

## Test eSewa UAT

1. Set `ESEWA_SANDBOX_SECRET_KEY` from the official
   [eSewa test-credentials page](https://developer.esewa.com.np/pages/Test-credentials).
   Obtain the current test login values from that page at test time; this guide
   deliberately does not copy passwords, MPINs, OTPs or secrets.
2. Keep `PAYMENT_PUBLIC_BASE_URL` and
   `PAYMENT_CHECKOUT_SIGNING_SECRET` configured, then restart the backend.
3. In Flutter, create a booking, select **eSewa**, and start payment.
4. Open the Bike Buddy bridge URL. It should immediately submit to the official
   eSewa UAT form page. Complete the test transaction with the current official
   test account.
5. Return to Bike Buddy and wait for or request a status check.

The backend signs the exact ordered eSewa request fields
`total_amount,transaction_uuid,product_code`, validates the signed Base64 return
payload, and independently calls eSewa's UAT status endpoint. It accepts only
`COMPLETE` with the expected `EPAYTEST` product code, reference and amount as
success. `PENDING` or `AMBIGUOUS` remains on hold; `NOT_FOUND` or `CANCELED`
fails. A provider-reported refund is recorded for reconciliation but Bike Buddy
does not initiate eSewa refunds.

## Test Khalti sandbox

1. Follow the official
   [Khalti sandbox access instructions](https://docs.khalti.com/khalti-epayment/#getting-started)
   to create/use a test merchant and obtain its sandbox key. Put that value only
   in `KHALTI_SANDBOX_SECRET_KEY`. Use the current test wallet login values from
   the same official page instead of copying them into project files.
2. Set `PAYMENT_WEBSITE_URL` and `PAYMENT_PUBLIC_BASE_URL` to appropriate public
   HTTPS origins, then restart the backend.
3. In Flutter, create a booking, select **Khalti**, and start payment.
4. Open the returned Khalti-hosted `payment_url`, complete the sandbox journey,
   and return to Bike Buddy.
5. Wait for or request a status check.

Bike Buddy initiates Khalti on the backend, sends the locked amount in paisa,
and stores Khalti's `pidx`. The redirect query is not trusted. The backend calls
the authenticated lookup endpoint and accepts only `Completed` with the same
`pidx` and total amount as success. `Pending` and `Initiated` remain on hold;
`Expired`, `User canceled` and failed states fail. A provider-reported
`Refunded` state is recorded, but the project does not call Khalti's refund API.
Khalti's documented minimum is NPR 10 (1,000 paisa), so lower totals are
rejected before checkout.

## Safe demo-video flow

For a dependable recording under ten minutes, use `PAYMENT_MODE=demo`. Show the
locked itemised total, select eSewa or Khalti, point out the **coursework demo / no
charge** notice, complete the explicit local simulation, and then show that the
paid request is still awaiting owner approval. Say plainly that no provider was
contacted and no money moved.

An optional sandbox clip is appropriate only after testing the network, tunnel
and provider account before recording:

1. Show Bike Buddy's sandbox/no-real-charge badge and locked reference.
2. Open the external hosted checkout without revealing `.env`, browser password
   managers, wallet credentials, OTPs or developer logs.
3. Return to the app and show **Payment verified** from the backend status
   check.
4. Show the booking as paid but awaiting owner acceptance.

Do not claim live charging, automatic refunds, background payment push, or a
native wallet SDK. Flutter polls only while the payment UI/app is active and
also offers a manual status check.

## Troubleshooting

| Symptom                                         | Check                                                                                                                                                                       |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payment is not configured                       | Confirm `PAYMENT_MODE=sandbox`, the public origins and the selected provider secret are present; restart the backend after edits. `live` always rejects.                    |
| Callback page cannot open                       | Confirm the HTTPS tunnel is running, still has the same origin and forwards to port `5050`. Do not use a phone/emulator loopback URL as the public origin.                  |
| Provider returns unauthorized                   | Replace the merchant secret with the current sandbox/UAT value from the provider's own portal/docs. Do not use a public/client key.                                         |
| eSewa signature fails                           | Copy the UAT merchant secret exactly, preserve special characters, and initiate a new attempt after restarting. Never alter signed fields in the browser.                   |
| Khalti rejects the request                      | Check the sandbox key, public `website_url`, callback origin and that the locked amount is at least 1,000 paisa.                                                            |
| App says payment is pending                     | Returning from a browser is not proof. Wait for the lookup interval, then use **Check payment status**. Do not create repeated attempts.                                    |
| Booking hold expired                            | Start a fresh booking request. An expired unpaid request is deliberately not revived, even if an old checkout page is still open.                                           |
| Verification mismatch or reconciliation warning | Do not approve the rental. Preserve the payment reference and provider status for an administrator; the server intentionally fails closed on mismatched or unknown results. |
| Checkout link expired or was cancelled          | Return to the booking and choose another payment attempt/method. A cancelled or expired checkout is not paid.                                                               |

## Verification checklist

- [ ] `.env` is ignored and no secret appears in Git, Flutter, web code or logs.
- [ ] Mode is visibly `demo` or `sandbox`; `live` initiation is rejected.
- [ ] The public callback and website values are stable HTTPS origins.
- [ ] Flutter opens an external browser, not an embedded WebView or provider SDK.
- [ ] The booking's server-calculated amount/reference match the checkout.
- [ ] A redirect alone never changes the booking to paid.
- [ ] eSewa succeeds only after signed response and status verification.
- [ ] Khalti succeeds only after lookup returns `Completed` with matching ID and amount.
- [ ] Unknown, pending or mismatched states do not grant the rental.
- [ ] Successful payment leaves the booking awaiting owner approval.
- [ ] Demo and sandbox receipts remain visibly labelled as non-live/test records.

## Known limitations

- The integration is sandbox/demo only; production merchant onboarding,
  settlement and live endpoints are absent.
- There is no native eSewa/Khalti SDK and no embedded WebView.
- There is no provider refund initiation. Provider-reported refund states are
  status/reconciliation records only.
- There is no operating-system background payment push. Automatic checks run
  only while the relevant Flutter UI/app is active; renters can check again
  later.
- A public HTTPS tunnel and internet access are required for hosted sandbox
  checkout. Tunnel reliability and provider availability are outside Bike
  Buddy's control.
- Sandbox credentials and provider behaviour can change. Use the linked
  official documentation at test time.
