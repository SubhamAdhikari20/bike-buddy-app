# Live notification guide

Bike Buddy implements its own notification inbox with MongoDB and authenticated
Server-Sent Events (SSE). It does not use Firebase Cloud Messaging, OneSignal,
Pusher, Ably, or another hosted notification service.

The inbox is durable. The web portal and Flutter app receive new records live
while they are open, then recover missed records from MongoDB after a reconnect
or normal refresh. This is foreground delivery, not operating-system push.

Implementation references:

- [WHATWG Server-Sent Events standard](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [Node.js HTTP response API](https://nodejs.org/api/http.html#responseflushheaders)
- [MongoDB single-document atomicity](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/)
- [MongoDB TTL indexes](https://www.mongodb.com/docs/manual/core/index-ttl/)

## Delivery model

1. A successful Bike Buddy domain action, such as an owner accepting a booking,
   asks the internal notification service to create a recipient-scoped record.
2. A stable deduplication key prevents the same domain transition from creating
   duplicate messages.
3. MongoDB atomically allocates a per-recipient sequence and stores the record.
4. The in-process stream hub sends the new record to that recipient's currently
   connected clients.
5. The client stores the latest sequence. If the connection closes, SSE
   reconnects and supplies the last event ID; the backend replays later durable
   records in sequence order.
6. If the replay gap is too large, the server emits a `resync` event and the
   client reloads its inbox through the normal paginated API.

The live hub is intentionally suitable for the coursework's single backend
process. With multiple backend instances, immediate fan-out would require a
self-hosted shared broker or MongoDB change-stream design. Durable REST/replay
still prevents notification history from depending on an open connection.

## Privacy and authorization

- Every notification belongs to one authenticated base-user ID. Role names are
  display/routing metadata, never a shared role-wide authorization boundary.
- List, unread, read and stream operations always derive the recipient from the
  authenticated session. A foreign notification ID returns `404` rather than
  revealing that it exists.
- Browsers authenticate with the existing HttpOnly cookie and
  `EventSource(..., { withCredentials: true })`. Flutter sends its bearer token
  in the `Authorization` header on a dedicated streaming request. Tokens are
  never placed in query parameters.
- Payloads contain a typed action resource and entity ID, not a server-supplied
  arbitrary URL. Each client maps the action to a route allowed for its role.
- Notifications do not contain email addresses, phone numbers, wallet IDs,
  provider callback data, KYC documents, evidence URLs, or SOS coordinates.
- Stream connections are capped, heartbeat-cleaned, and closed periodically so
  authentication is checked again on reconnect. Clients close immediately on
  logout, pause, unmount, or disposal.

## API and stream contract

All routes are under `/api/v1/notifications` and require authentication:

| Method and route | Purpose |
| --- | --- |
| `GET /?before=<sequence>&limit=20&unreadOnly=false` | Cursor-paginated inbox plus unread count. |
| `GET /unread-count` | Lightweight unread total. |
| `PATCH /:notificationId/read` | Idempotently mark one owned record read. |
| `PATCH /read-all` | Mark every unread record for the current user read. |
| `GET /stream` | Open the authenticated SSE connection. |

The stream uses `text/event-stream`, UTF-8 records, numeric sequence IDs, a
five-second reconnect hint and comment heartbeats. Durable notification events
use the `notification` event name. Control events such as `ready` and `resync`
do not become inbox items or user-facing toast messages.

The backend replays at most 100 missed records on one connection. Replayed
items update the inbox silently; Sonner or SnackBar feedback is reserved for a
genuinely new foreground event.

## Backend configuration

The defaults in `backend/.env.sample` are appropriate for the local demo:

| Variable | Default | Purpose |
| --- | ---: | --- |
| `NOTIFICATION_RETENTION_DAYS` | `90` | Durable inbox retention before TTL cleanup. |
| `NOTIFICATION_MAX_CONNECTIONS_PER_USER` | `3` | Prevent one account from exhausting stream capacity. |
| `NOTIFICATION_MAX_CONNECTIONS_TOTAL` | `500` | Bound live connections in the single API process. |

Replay is capped at 100 records, heartbeats are sent every 20 seconds, and a
stream is closed after 30 minutes so the reconnect passes through normal
authentication again. Those implementation limits are server-owned rather than
client-controlled.

## Retention and state

Notification records carry an expiry date and use a single-field MongoDB TTL
index. TTL deletion is storage cleanup rather than an exact timer: MongoDB's
background monitor may remove an expired record later than its timestamp. API
queries therefore also exclude expired records.

Read state is durable in MongoDB. Clients may cache a sequence cursor for
reconnection, but the server remains authoritative for inbox contents and the
unread count.

## Role examples

- An owner receives a new booking request and a verified paid request for one
  of their bikes.
- A renter receives owner approval/rejection, payment verification, cash
  acknowledgement, return, support, KYC, and safety workflow updates.
- Administrators receive reconciliation warnings, support tickets, damage
  reports, and SOS records without private evidence or coordinates inside the
  notification itself. Their owner/KYC review decisions notify the affected
  user.

Only the successful, guarded state transition emits a notification. Repeated
status polling does not. Notification delivery is best effort after the domain
write, so a temporary notification failure cannot convert an already completed
booking or payment action into a misleading API failure.

## Demo sequence

1. Sign in to the owner portal and the renter Flutter app with two demo users.
2. Leave the notification bell visible in both sessions.
3. Create a fresh renter booking. Show the owner's unread badge update while
   the portal is open.
4. Approve the request in the portal. Show the renter's foreground notification
   and open its booking action.
5. Briefly disable/reconnect the client, perform another action, then show that
   the durable inbox catches up after refresh/reconnect.

Say "foreground live notification with durable replay." Do not call this a
phone push notification, background service, guaranteed delivery broker, SMS,
email, or emergency dispatch integration.
