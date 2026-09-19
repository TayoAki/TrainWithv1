# TrainWith

Expo SDK 57 app with a Fastify API, Supabase authentication/PostgreSQL, Stripe sandbox memberships and Connect onboarding, and Mux upload/signed-playback integration.

This branch implements a connected sandbox beta, deployed at [the TrainWith preview](https://web-staging-ff99.up.railway.app). The hosted API connects to Supabase, Mux Video and Stripe sandbox. A real Mux upload, webhook delivery and protected playback have been verified. Native purchases and live Stripe payments are disabled. See [backend setup and current status](docs/setup/BACKEND.md) for admin setup, public auth email delivery and the remaining acceptance checks.

## Run connected development

Use Node 22.22.2 (`nvm use`). Configure `.env.local` and `backend/.env.local` from the example files. Credentials stay out of Git.

```sh
npm ci
npm ci --prefix backend
npm --prefix backend run migrate
npm --prefix backend run dev
# Another terminal:
npm run web
```

The API is on port 3001 and Expo web on 8081. Use a reachable API URL for physical devices. Native development and bundle exports are supported; store billing is not enabled.

## Run the original local demo

```sh
EXPO_PUBLIC_DEMO_MODE=true npx expo start --clear --web
```

Demo mode uses seeded fictional coaches, device-local storage, simulated purchases and local videos. It is separate from connected mode and is not a deployable backend. Never publish a demo-mode export to testers expecting real accounts or payments.

## Verify

```sh
npm run verify
npm run verify:backend
npm run test:ui
npm run test:connected
npx expo export --clear --platform ios --platform android --output-dir dist-native
```

Backend tests exercise the real SQL migration with PGlite, authorization, signed webhooks, payment retries, refunds and access control. Connected UI checks use mocked provider/API responses. The existing 12 demo interaction groups are regression checks, not evidence of hosted billing. Live acceptance remains required.

Clean Metro caches when switching public environment values: they are compiled into the bundle. The export/test scripts do this explicitly.

## Structure

- `app/`, `src/`: Expo Router screens, design system and connected client adapters.
- `backend/src/`: API, verified authentication, server authorization, billing and durable webhook worker.
- `supabase/migrations/`: application and private database schemas with RLS.
- `backend/tests/`: PostgreSQL/API integration tests.
- `Dockerfile`, `Dockerfile.web`, `deploy/Caddyfile`, `.railway/railway.ts`: Railway API/web builds and infrastructure.
- `docs/setup/BACKEND.md`: credentials, operational runbook, API map and remaining launch work.
- `docs/launch/`: the pre-implementation launch audit and plan; historical baseline.

The marketing site in the separate FitME workspace is not rebuilt or deployed by this backend change.

## Demo asset credits

Illustrative photos are from Unsplash. Bundled files preserve the original demo visuals; the branded sample video is not a fitness lesson. Use approved, creator-owned footage and licensed artwork before publishing real channels.
