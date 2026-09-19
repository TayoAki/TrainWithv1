# TrainWith accounts and credential checklist

September 19, 2026. Companion to the [launch plan](LAUNCH_PLAN.md). All environment variable names below are proposed conventions; the current frontend does not yet consume these integrations. No credentials have been created or embedded by this planning task.

## Ownership and setup order

GitHub access is verified as `TayoAki`, and the repository is cloned at `/Users/juniper/TrainWithv1`. Access to the other providers has not been checked. Create accounts under the business, with owner-controlled recovery and MFA, rather than under a contractor's personal account.

| Order | Account / prerequisite              | What to prepare                                                                          | Needed for                                 |
| ----- | ----------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1     | Domain and DNS                      | Confirm domain ownership, application/API subdomains, support address, sender domain     | All production URLs, auth redirects, email |
| 2     | Expo organization                   | Owner, project, app identifiers                                                          | Development builds now; stores later       |
| 3     | Supabase organization               | Separate staging and production projects in chosen region                                | Authentication, database, image storage    |
| 4     | Railway workspace                   | Staging and production environments, GitHub app access to this repo                      | API and worker                             |
| 5     | Stripe platform                     | Business country/entity, bank details, enabled Connect model; start in sandbox/test mode | Web subscriptions and coach onboarding     |
| 6     | Mux account                         | Separate environments, usage limits, API access                                          | Real upload and playback                   |
| 7     | Resend account                      | Verified sending domain, SPF/DKIM and appropriate DMARC, sender addresses                | Auth and transactional mail                |
| 8     | Cloudflare Pages                    | Git integration and DNS access                                                           | Marketing site                             |
| 9     | Sentry project(s)                   | Expo/client and API projects, release identifiers                                        | Production error reporting                 |
| 10    | Apple Developer + App Store Connect | Appropriate account type, legal identity, agreements, banking/tax setup                  | iOS/TestFlight and store payments          |
| 11    | Google Play Console                 | Appropriate account type, identity verification, agreements, payments setup              | Android distribution and store payments    |
| 12    | RevenueCat                          | Project, store apps/credentials, product mappings                                        | Native purchases if using IAP              |

Each coach completes their own hosted payment onboarding. TrainWith should not collect bank passwords or copy identity documents into its own app just to mark payout setup complete.

## Values allowed in the Expo client

Anything shipped in JavaScript, app configuration, or a native bundle can be recovered. `EXPO_PUBLIC_` means public; EAS secret visibility does not make a value secret if application code embeds it. [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)

| Proposed variable                        | Value / where to get it                                           | Timing                                                        |
| ---------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| `EXPO_PUBLIC_APP_ENV`                    | `development`, `preview`, or `production`                         | First integration                                             |
| `EXPO_PUBLIC_API_URL`                    | Public Railway API URL/custom domain                              | First integration                                             |
| `EXPO_PUBLIC_SUPABASE_URL`               | Supabase project URL                                              | Authentication                                                |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`   | Project Connect dialog or Settings → API Keys; `sb_publishable_…` | Authentication                                                |
| `EXPO_PUBLIC_SENTRY_DSN`                 | Client project DSN; configure scrubbing and abuse controls        | Beta                                                          |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`     | RevenueCat iOS public SDK key                                     | Native billing                                                |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | RevenueCat Android public SDK key                                 | Native billing                                                |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`     | Stripe publishable key, only if client-side Stripe SDK is used    | Optional; hosted Checkout URL redirection does not require it |

Supabase's publishable key identifies the application, not an authenticated user or their permissions. Enforce database policies and verify user sessions. Prefer current publishable/secret key types over copying legacy `anon`/`service_role` examples into a new integration. [Supabase key types](https://supabase.com/docs/guides/getting-started/api-keys)

App IDs, Supabase project refs, EAS project IDs, Stripe price IDs, and Mux playback IDs are identifiers, not credentials that authorize access. They still need validation against trusted server records. Signed upload/playback URLs are temporary bearer credentials and should not be logged or made public.

## Secrets kept on Railway / trusted server systems

Create separate values for staging and production. Use the provider secret manager, never a public repository or the Expo client. Grant each service only the permissions it needs.

| Proposed variable                                | Purpose                                                              | Where obtained / restriction                                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `SUPABASE_URL`                                   | Server project endpoint; not itself secret                           | Supabase Connect dialog                                                                                |
| `SUPABASE_SECRET_KEY`                            | Privileged auth/admin or event processing operations                 | Supabase API keys; bypasses RLS, so every privileged endpoint needs explicit authorization             |
| `DATABASE_URL`                                   | Postgres connection for API/worker role                              | Supabase connection settings; select pooling mode compatible with the database client/job system       |
| `DATABASE_MIGRATION_URL`                         | Separate elevated migration connection                               | Restricted CI migration environment, not ordinary frontend builds                                      |
| `STRIPE_SECRET_KEY`                              | Create Checkout sessions, subscriptions, Connect onboarding, refunds | Stripe restricted key where supported, or server secret key with narrowly controlled access            |
| `STRIPE_WEBHOOK_SECRET`                          | Verify platform/Billing events                                       | Secret for the actual Stripe webhook endpoint; local CLI secret differs                                |
| `STRIPE_CONNECT_WEBHOOK_SECRET`                  | Verify connected-account events when using a separate endpoint       | Connect event destination configuration; do not assume the platform endpoint secret is interchangeable |
| `MUX_TOKEN_ID` + `MUX_TOKEN_SECRET`              | Create uploads, inspect/delete assets                                | Mux API access token for the correct environment                                                       |
| `MUX_WEBHOOK_SECRET`                             | Validate video processing events                                     | Mux event endpoint settings                                                                            |
| `MUX_SIGNING_KEY_ID` + `MUX_SIGNING_PRIVATE_KEY` | Mint short-lived playback tokens after access checks                 | Mux signing keys; private key stays server-side                                                        |
| `RESEND_API_KEY`                                 | Transactional email                                                  | Resend API keys, restrict to sending/domain where possible                                             |
| `EMAIL_FROM` + `SUPPORT_EMAIL`                   | Verified sender and monitored destination; not secrets               | Business email configuration                                                                           |
| `REVENUECAT_SECRET_API_KEY`                      | Server reconciliation/admin API access, if needed                    | RevenueCat project key with appropriate permissions                                                    |
| `REVENUECAT_WEBHOOK_AUTHORIZATION`               | Shared authorization value configured for RevenueCat events          | Generate securely and configure in both systems; validate on receipt                                   |
| `SENTRY_DSN`                                     | API error reporting; not a privileged API token                      | API Sentry project                                                                                     |

The ordinary API request path should authenticate the user and enforce ownership. Do not run every query with an unrestricted database credential and assume RLS will protect it. Keep privileged writes to payments, access, ledger, and moderation behind explicit server authorization.

Use provider-specific webhook authentication. Stripe and Mux signatures require their prescribed verification, including the correct raw payload handling; RevenueCat supports a configured authorization header. Persist event IDs, reject invalid requests, and deduplicate valid retries. [Stripe webhooks](https://docs.stripe.com/webhooks) · [Mux webhooks](https://www.mux.com/docs/core/listen-for-webhooks) · [RevenueCat webhooks](https://www.revenuecat.com/docs/integrations/webhooks)

For Supabase email authentication, configure custom SMTP using the selected mail provider's SMTP host, port, username, password, and verified sender in the Supabase dashboard. The SMTP password belongs in that server-side configuration. Also set exact allowed web/native redirect URLs and test expired links and mobile deep links. [Resend API keys](https://resend.com/docs/dashboard/api-keys/introduction)

## Build, deployment, and store credentials

These grant deployment or store access. Keep them out of application runtime configuration.

| Credential / identifier                               | Where it belongs                                                                | Notes                                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `EXPO_TOKEN`                                          | Restricted CI environment                                                       | For automated EAS builds/submissions; interactive local login is an alternative                                  |
| EAS project ID / organization                         | Expo app configuration                                                          | Public identifiers; project ownership must be correct                                                            |
| `ios.bundleIdentifier`, `android.package`             | App configuration and matching store entries                                    | Pick permanent available IDs; do not use an unverified suggested ID                                              |
| Apple distribution certificate + provisioning profile | EAS credentials service or controlled signing system                            | EAS can manage signing; export/recovery policy belongs to the account owner                                      |
| App Store Connect API key `.p8`, Key ID, Issuer ID    | EAS/CI submission integration and authorized RevenueCat configuration as needed | Use appropriate key type/roles; store upload and purchase validation integrations may have distinct requirements |
| Google Play service account JSON                      | EAS submission integration / authorized RevenueCat integration                  | Grant only required app/API permissions; do not commit JSON                                                      |
| Android upload keystore and passwords                 | EAS signing credentials                                                         | Keep ownership/recovery documented; enable Play App Signing appropriately                                        |
| `RAILWAY_TOKEN`                                       | CI only if CLI deployment is used                                               | Not needed in the app; GitHub integration can handle deploy authorization                                        |
| `CLOUDFLARE_API_TOKEN` and account ID                 | CI only if using CLI deploys                                                    | Scope to the target site; Git integration can avoid a separate CI token                                          |
| Supabase CLI access token and migration credentials   | CI migration job only                                                           | Separate schema-deployment privileges from normal API access                                                     |
| `SENTRY_AUTH_TOKEN`                                   | Build/CI only                                                                   | Source-map uploads; separate from client DSN                                                                     |
| GitHub deployment permissions                         | GitHub environment / installed provider apps                                    | Scope providers to the intended repository; do not reuse a broad personal token everywhere                       |

RevenueCat's SDK uses its public platform key; server secrets do not belong in the Purchases SDK. Store products, billing agreements, and store credentials must also be configured—an SDK key by itself cannot enable purchases. [RevenueCat keys](https://www.revenuecat.com/docs/projects/authentication)

## Values not required for the initial beta

- No OpenAI/Anthropic key: AI coaching is outside the launch scope.
- No Firebase database: Supabase is the proposed system of record.
- No Twilio key: start with verified email, not SMS login.
- No push credentials until notifications are deliberately added. Push would introduce APNs/FCM configuration and permission work.
- No Google/Apple social-login OAuth credentials if email is the only login method. Adding social login needs a separate platform-policy review and provider setup.
- No Redis account initially if durable jobs use Postgres.

## Credential handoff and verification

1. Create owner-controlled accounts and invite collaborators with roles. Do not paste secret values into chat.
2. Put values directly into Railway, Supabase, EAS, or the relevant protected CI environment. Keep only empty/example variable names in git.
3. Record the account owner, environment, purpose, permissions, rotation procedure, and last verification date; never record secret values in this checklist.
4. Validate staging end to end with test money and test identities. Keep live billing credentials unavailable to preview branches and untrusted pull-request builds.
5. Inspect exported web/native artifacts for accidental secrets before release; rotate any exposed credential rather than only deleting it from git.
6. Promote production configuration deliberately, then run a small controlled live purchase/refund/payout verification with authorized operators.
