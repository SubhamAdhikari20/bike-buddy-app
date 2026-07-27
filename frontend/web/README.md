# Bike Buddy web portal

The Next.js portal serves bike owners and administrators. Renters use the
Flutter app; Google authentication is deliberately limited to the renter
workflow.

## Local setup

1. Copy `.env.sample` to `.env.local`.
2. Start the backend on port `5050`.
3. Run `npm install`, then `npm run dev`.
4. Open `http://localhost:3000`.

Authentication uses the backend's HttpOnly `accessToken` cookie. The browser
API client always sends credentials and does not persist access tokens in web
storage. Configure the backend `WEB_ORIGIN` to the exact portal origin.

## Quality checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

The UI uses the shadcn `base-nova` style backed by Base UI primitives. The
portal includes keyboard-visible focus, a skip link, status announcements,
responsive navigation, reduced-motion support and light/dark themes.
