# TrainWith backend setup

Status: 19 September 2026. Implemented for a connected sandbox beta. The Supabase schema is installed and Railway is prepared; the hosted API and production billing are **not live**.

## Implemented

- Fastify API with Supabase verified-email authentication, explicit ownership checks and strict command validation.
- PostgreSQL migrations for profiles, channels, workouts, ordered programs, saved programs, completions, support requests, video assets, subscriptions, payment ledger, payouts and audit records. RLS protects application tables; clients cannot write directly. Provider/financial records use a private schema.
- Stripe sandbox Checkout, Express Connect onboarding, billing portal, cancellation/resumption and verified webhooks. Prices and creator destinations come from the server. Durable checkout attempts preserve the exact payload and idempotency key across lost responses.
- Database webhook queue with deduplication, backoff, restart recovery and administrator retry. Stripe state is fetched authoritatively. Access follows the paid invoice's period, including delayed invoices and failed renewals. Refunds/disputes revoke the affected current invoice. Checkout redirects cannot grant access.
- Mux direct browser uploads, processing events and server-authorized signed playback. Replaced asset events are ignored. Signed assets up to three hours can publish; browser selection limits files to 5 GB. Uploads have request and pending-job limits.
- Connected Expo screens by default; explicit demo mode for the original prototype. Native sessions use SecureStore; browser sessions stay in memory, so browser reloads require signing in again.
- Server-backed creator members/earnings and private support storage. Payment totals are not presented as withdrawable funds. Resend and Sentry are paused.

## Railway already prepared

| Item                | Value                                                                         |
| ------------------- | ----------------------------------------------------------------------------- |
| Project             | [TrainWith](https://railway.com/project/c5175ac7-0da8-4a7d-90cf-560b944fc091) |
| Environment/service | `staging` / `api`                                                             |
| Reserved hostname   | `https://api-staging-4654.up.railway.app`                                     |
| Readiness           | `/readyz` checks PostgreSQL schema; `/healthz` checks process                 |
| Build               | Root `Dockerfile`, Node 22, non-root runtime                                  |
| Infrastructure      | `.railway/railway.ts`, applied to staging                                     |

Supabase URL/public key, the verified database connection and CA certificate, Stripe sandbox secret, port, worker flag and a **0% sandbox platform fee** are saved as staging variables. This fee is a test setting, not an agreed commercial fee. Production has no credentials or deployment.

The reserved hostname is not a working API yet. Migration `202609190001_trainwith.sql` was applied transactionally through the authenticated Supabase SQL editor. An independent query confirmed all **17 application tables have RLS enabled**. The supplied temporary database password is verified, and the database connection and Supabase CA are configured locally and on Railway staging. Certificate and hostname verification remain enabled. The migration checksum matches the repository. Local API checks against the real database return 200 for `/readyz` and `/v1/state`. The API still needs its HTTPS frontend URL and provider setup before deployment. `/readyz` prevents a disconnected API from passing deployment readiness.

Railway infrastructure changes require `railway config plan` followed by a reviewed `railway config apply`. Railway does not automatically read `.railway/` during app deployments. The root Dockerfile is auto-detected. See [Railway's IaC guide](https://docs.railway.com/infrastructure-as-code).

## Inputs still required

| Input                                           | Purpose and location                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`              | Backend/Railway; Video API upload and asset access                              |
| `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY` | Backend/Railway; signed playback                                                |
| `MUX_WEBHOOK_SECRET`                            | Backend/Railway after creating the Mux webhook destination                      |
| `STRIPE_WEBHOOK_SECRET`                         | Backend/Railway after creating the account webhook destination                  |
| `STRIPE_CONNECT_WEBHOOK_SECRET`                 | Backend/Railway after creating the connected-account event destination          |
| `APP_URL`, `ALLOWED_ORIGINS`                    | Actual HTTPS Expo web-app URL; provider return URLs and allowed browser origins |
| `ADMIN_USER_IDS`                                | Supabase Auth UUIDs of operators who may approve channels and read support      |

The DB file uses the observed Supabase session pooler host for this project. TLS certificate verification remains enabled; use `DATABASE_CA_CERT` if the provider requires its project CA. Never disable certificate verification.

The supplied Mux environment key is **Mux Data analytics configuration**, not a Mux Video API token. It is saved privately for later analytics work. The RevenueCat Test Store key is also saved, but native purchases and the RevenueCat webhook remain disabled. Hosted Stripe Checkout does not need the publishable key. No Supabase service-role key is needed for the implemented routes.

Secrets are excluded from Git and Docker. Configure Railway secrets through its dashboard or `railway variable set NAME --stdin --skip-deploys`, never CLI arguments or commits. Rotate the Stripe secret that was pasted into the conversation before relying on this environment.

## Finish provisioning

1. The initial schema and database credentials are configured. Use `npm --prefix backend run migrate` for future migrations. Migrations are transactional and checksum-tracked, and do not modify existing `public` tables. Never edit a migration after it is applied. When rotating the database password, update the ignored local database file and Railway `DATABASE_URL` together. Before production, create a restricted API database role and keep the administrative migration credential separate.
2. Set `APP_URL` and exact `ALLOWED_ORIGINS` to the deployed Expo app, and `NODE_ENV=production`. Hosted mode requires HTTPS. Local development uses ports 3001 (API) and 8081 (Expo).
3. Configure Mux Video credentials, a playback signing key and webhook destination `https://api-staging-4654.up.railway.app/webhooks/mux`. Subscribe to upload asset-created and asset ready/errored events. Save its webhook secret.
4. Create sandbox Stripe destinations at `https://api-staging-4654.up.railway.app/webhooks/stripe`. Account events: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`, `charge.dispute.created/updated/closed`. Connected-account events: `account.updated`, `payout.created/updated/paid/failed/canceled`. Save each destination's signing secret. Configure the billing portal for cancellation and payment-method changes, without arbitrary subscription price changes.
5. Deploy from the repo root: `railway up --service api --environment staging --detach`. Verify `/readyz`, `/v1/state` and logs. Use one API replica for this beta. The durable worker runs inside the API by default; a separate worker can use `node backend/dist/worker.js` with `RUN_WORKER=false` on the API.
6. Set frontend `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WEB_URL`; retain Supabase public values. Re-export with a clean Metro cache. Public variables are compiled into bundles. `test:ui` builds demo mode and must not supply the connected deployment artifact.
7. Configure Supabase Auth site URL/redirects and keep email confirmation on. Resend can remain paused, but another SMTP provider is needed for public email signup: Supabase's default email service restricts recipients and is unsuitable for public launch. See [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).
8. Sign in with a verified operator account and configure its UUID. Create a coach channel, complete sandbox Connect onboarding, upload real free/paid videos, approve the coach through the admin API, then publish.
9. Complete hosted acceptance below before inviting testers. Create an isolated production Supabase environment before accepting real customer data.

## Local checks

```sh
nvm use
npm ci
npm ci --prefix backend
npm run verify
npm run verify:backend
npm run test:ui
npm run test:connected
npx expo export --clear --platform ios --platform android --output-dir dist-native
```

Backend tests run the actual SQL migration in PGlite's PostgreSQL engine and use Fastify injection. Provider calls/identities are fixtures; Stripe signatures use the real SDK. Connected UI tests mock Auth/API responses and reject unexpected network access. These checks are not evidence of a live Supabase/Stripe/Mux round trip.

The frontend dependency audit reports 14 moderate Expo/ngrok dependency findings, with no high or critical findings. The backend audit is clean. Review compatible SDK upgrades before launch; do not force incompatible Expo transitive versions.

## API map

| Route                                              | Access/use                                                  |
| -------------------------------------------------- | ----------------------------------------------------------- |
| `GET /v1/state`                                    | Public catalog plus the current user's private state        |
| `POST /v1/commands`                                | Verified account; allowlisted, ownership-checked operations |
| `POST /v1/billing/checkout`                        | Member; server-owned price and Connect destination          |
| `POST /v1/billing/portal`, `/renewal`              | Current user's billing account/subscription                 |
| `POST /v1/connect/onboarding`, `/refresh`          | Creator owner                                               |
| `POST /v1/videos/upload`                           | Workout owner; direct upload URL                            |
| `POST /v1/videos/playback`                         | Owner, published free sample or paid member                 |
| `GET /v1/studio/:creatorId`                        | Owner; members, ledger and payouts                          |
| `POST /webhooks/stripe`, `/mux`                    | Verified signatures, durable enqueue                        |
| `POST /webhooks/revenuecat`                        | Disabled, returns 503                                       |
| `GET /v1/admin/status`, `/support`                 | Operator UUID allowlist                                     |
| `POST /v1/admin/creators/approve`, `/events/retry` | Operator allowlist and audit record                         |

## Hosted acceptance and launch gaps

Before beta: two verified test accounts; ownership rejection; creator approval and Connect readiness; actual upload/transcode/signed playback; sandbox checkout; renewal failure; cancellation; refund; webhook replay; worker restart; account switching; native playback; origin restrictions and a restore procedure.

Before public launch: agreed fees/refund/payout policies; activated Stripe/Connect live account and a reviewed live-key change (currently rejected); RevenueCat store catalog/native SDK/reconciliation; Apple Developer Program and store submission; password recovery and automated deletion/export; persistent browser login; moderation and support ownership; licensed creator content; privacy/terms; database backup restoration; external error/queue alerts; scheduled provider reconciliation. Resend and Sentry are optional choices, but public auth mail and actionable monitoring are still required.

Beta limits: state reads cap at 300 creators, 3,000 workouts and 1,000 programs; studio lists cap at 1,000 members. Add pagination before scaling. Direct video upload currently uses web Studio. Totals represent recorded receipts, not available payouts. No real-money purchase or payout was created during setup.
