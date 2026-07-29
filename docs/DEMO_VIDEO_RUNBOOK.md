# Bike Buddy demonstration runbook

This is a practical 12-16 minute recording plan. Use email/password for the
demo because Google, Maps, email delivery and live payments depend on separate
provider configuration. Wallet payment remains visibly labelled as a
coursework simulation.

## Demo accounts

All demo accounts use `Password@123`.

| Role | Account | Purpose |
|---|---|---|
| Admin | `admin@bikebuddy.com` | Verify owners and moderate platform data |
| Verified owner | `ramesh.owner@bikebuddy.com` | Main fleet CRUD and booking demo |
| Pending owner | `sita.owner@bikebuddy.com` | Show the verification boundary |
| Renter | `aashish@student.com` | Budget search and comparison |
| Renter | `maya@student.com` | First-time booking and safety |
| Renter | `saroj@student.com` | Condition evidence and trust |
| Renter | `nishant@student.com` | Reservation and route continuity |
| Renter | `binita@student.com` | Cash, return and accessibility |
| Renter | `krish@student.com` | Specifications, rates and reviews |
| Renter | `mohammad@student.com` | Pricing, payment state and receipt |
| Renter | `dipesh@student.com` | Changes, support and damage reporting |

## Before recording

1. In Atlas Network Access, allow the filming computer's current public IP.
2. From `backend`, run `npm run seed`. The summary must show 11 users, 2
   owners, 8 renters and the linked demo records.
3. Start the backend with `npm run dev`.
4. From `frontend/web`, run `npm run dev`.
5. Optionally start Flutter on Chrome with
   `flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:5050`.
6. Run `npm run demo:verify` once. It creates, reads, updates and deletes a
   throwaway bike and leaves the prepared demo fleet unchanged.
7. Open `http://localhost:3000/login` and keep Atlas Collections in a separate
   tab with passwords and connection strings hidden.

## Recording script

### 0:00-1:00 - Introduction

"This is Bike Buddy, a motorbike rental experience designed around the
research pain points of unclear condition, hidden prices, uncertain
availability and low trust. I will demonstrate the renter, owner and
administrator roles using data stored in MongoDB Atlas."

Show the backend health response and briefly show the Atlas collection names
and counts. Do not show the connection string or environment file.

### 1:00-3:00 - Registration and role boundaries

Open the owner registration screen and explain the fields, password guidance
and immediate feedback. Mention that the prepared setup already registered all
eight renter personas plus two owners.

Sign in as Sita and open "List a new bike".

"A newly registered owner is pending. Bike Buddy explains that an
administrator must verify the account before a public listing can be created."

Sign out, log in as the administrator, open Owner Verification, and verify the
intended demo owner. This demonstrates role-based access and the trust signal.

### 3:00-8:00 - Owner bike CRUD

Log in as Ramesh and open My Bikes.

"Read: the fleet table shows each bike's city, category, daily rate, rating
and operational status. The owner sees only their own bikes."

Choose "List a new bike" and create a throwaway listing:

- Title: `Video Demo Honda Dio`
- Brand/model: `Honda` / `Dio`
- Year/engine: current year / `110`
- Category: scooter
- Condition: good
- Daily/hourly price: `950` / `140`
- Deposit: `1500`
- Pickup: `Baneshwor Demo Point`, `Kathmandu`, `New Baneshwor`

"Create: required fields and constrained choices prevent incomplete or
ambiguous listings. The API derives ownership from the signed-in owner."

Return to My Bikes, locate the new row and choose Edit. Change the title to
`Video Demo Honda Dio - Updated`, price to `1000`, condition to excellent and
status to maintenance. Save and show the updated fleet row.

"Update: the existing record is loaded from Atlas, edited, validated and
persisted. Status can also be changed quickly from the fleet table."

Open Edit again and delete the throwaway listing after reading the confirmation.

"Delete: an unbooked listing can be removed. Bike Buddy blocks deletion when
a bike has booking history and asks the owner to make it inactive instead, so
historical bookings and receipts remain meaningful."

### 8:00-11:30 - Renter journey

Open the Flutter app as Aashish. Show guest browsing, filters, map/list choice,
comparison and a bike details page.

"The renter can inspect price, owner verification, dated condition evidence,
specifications and reviews before signing in. Authentication is requested only
when booking begins."

Sign in, request a quote and show the locked itemised total. Complete either a
demo-wallet booking or select cash at pickup.

"This is explicitly a simulation: no real money is moved. Cash remains pending
until the correct owner records receipt."

If a saved booking banner is visible, press its arrow to demonstrate that
"Resume your booking" actually continues the saved flow.

### 11:30-13:30 - Booking, return and support

Back in the owner portal, show the prepared pending, confirmed and completed
bookings. Record cash receipt only on the matching cash booking.

Show the handover checklist, active ride, return preview, damage acknowledgement
and support ticket status using prepared records.

"SOS records an alert and shows emergency guidance; it does not claim that
Bike Buddy dispatches responders. Damage acknowledgement records that the
owner saw the report; it does not pretend the dispute is resolved."

### 13:30-15:00 - Close

Show the dashboard totals and Atlas document updates.

"The demonstration covered registration, role verification, complete owner
bike CRUD, renter discovery and booking, payment boundaries, safety, return
and support. The workflow is traceable across five sprints and the data remains
persisted in MongoDB Atlas."

## Filming safeguards

- Hide `.env`, tokens, cookies and the Atlas connection string.
- Delete only the fresh throwaway bike; seeded bikes have booking history.
- Do not claim real payments, refunds, responder dispatch, staffed chat or a
  guaranteed support response time.
- Run the automated checks before the final take and keep the terminal showing
  only pass/fail summaries.
