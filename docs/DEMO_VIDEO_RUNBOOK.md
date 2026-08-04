# Bike Buddy demonstration runbook

A practical recording plan for a video under ten minutes, running against a
local MongoDB with no Docker. Use email/password for the demo, because Google,
Maps, email delivery and live payments depend on separate provider
configuration. Wallet payment stays visibly labelled as a coursework
simulation.

The full shot-by-shot script with timings and spoken words lives in
`../../BIKE_BUDDY_DEMO_SCRIPT.md`. This file is the short operational
checklist.

## Demo accounts

All demo accounts use `Password@123`.

| Role           | Account                      | Purpose                                  |
| -------------- | ---------------------------- | ---------------------------------------- |
| Admin          | `admin@bikebuddy.com`        | Verify owners and moderate platform data |
| Verified owner | `ramesh.owner@bikebuddy.com` | Main fleet CRUD and booking demo         |
| Verified owner | `bimal.owner@bikebuddy.com`  | Second fleet in Bhaktapur                |
| Pending owner  | `sita.owner@bikebuddy.com`   | Show the verification boundary           |
| Rejected owner | `anjali.owner@bikebuddy.com` | Show a blocked listing                   |
| Renter         | `aashish@student.com`        | Budget search and comparison             |
| Renter         | `maya@student.com`           | First-time booking and safety            |
| Renter         | `saroj@student.com`          | Condition evidence and trust             |
| Renter         | `dipesh@student.com`         | Active ride, SOS and support             |
| Renter         | `krish@student.com`          | Cash booking awaiting owner receipt      |

Seven more renters (`nishant`, `binita`, `mohammad`, `pratima`, `sujan`,
`anita`, `roshan`) exist so the directory, reviews and support queue look
populated.

## Prepared data

`npm run seed` creates 17 accounts, 22 bikes across Kathmandu, Lalitpur and
Bhaktapur in all six categories, 28 bookings covering every status, 21 demo
payments, 12 verified-ride reviews, 12 support tickets, 5 damage reports and
4 SOS records. It also creates local multi-image motorcycle galleries,
synthetic profile/KYC/evidence fixtures and 7 durable notifications across the
three roles.

Fifteen bikes are `available` and therefore publicly discoverable. The other
seven are deliberately hidden from renter search: five `inactive` listings
belonging to the pending and rejected owners, one `maintenance` and one
`unavailable`.

## Before recording

1. Start MongoDB. Either `Start-Service MongoDB` as administrator, or run
   `mongod --dbpath C:\Users\<you>\mongodb-data\bike-buddy` in its own window.
2. From `backend`, run `npm run seed`. The summary must show 17 users, 22
   bikes and 28 bookings.
3. Start the backend with `npm run dev` and confirm
   `http://localhost:5050/health`.
4. From `frontend/web`, run `npm run dev`.
5. Start the Flutter app on the Android emulator, or on Windows desktop.
6. Run `npm run demo:verify` once. It creates, reads, updates and deletes a
   throwaway bike and leaves the prepared demo fleet unchanged.
7. Open `http://localhost:3000/login` and have MongoDB Compass ready in a
   separate tab if you want to show stored documents.

## Recording order

1. Introduction and problem framing.
2. Renter discovery in the Flutter app: guest browse, filter, compare, details.
3. Booking with the locked itemised total, then the demo payment boundary.
4. Safety: handover checklist, active ride, SOS, return and damage report.
5. Owner portal: fleet CRUD, pending booking approval, cash receipt.
6. Admin portal: dashboard, owner verification, support queue.
7. Trigger a booking update and show the role-scoped live notification in the
   portal/app, then close on traceability across the five sprints.

## Map view: ready without an API key

Bike Buddy uses OpenStreetMap tiles with Flutter Map, so the demo does not need
a Google Maps key or billing account. The map is reached from the "Explore on
Map" card on Home and the List/Map toggle on Search. Show the plain-language
foreground-location rationale, choose either consent option, and demonstrate
that the same server pickup coordinates drive both list and map views.
Internet access is still needed to fetch map tiles.

## Filming safeguards

- Hide `.env`, tokens, cookies and any connection string.
- Delete only a fresh throwaway bike; seeded bikes have booking history.
- Do not claim real payments, refunds, responder dispatch, staffed chat or a
  guaranteed support response time.
- Call notifications foreground in-app updates, not operating-system push.
- Run the automated checks before the final take and keep the terminal showing
  only pass/fail summaries.
