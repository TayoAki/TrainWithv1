# TrainWith readiness review

Assessed 19 September 2026 against code commit `e2082be`, the deployed Railway staging services, read-only Supabase/Stripe checks, and current Apple, Expo and RevenueCat documentation.

**Verdict: the backend and connected preview are working, but the app is not complete or ready for an unrestricted paid launch.** The earlier deployment proved infrastructure and provider connectivity. It did not prove a complete creator-to-consumer purchase journey or produce a signed iOS application.

Resend and Sentry are excluded as required vendors. Their absence is not itself a reason to delay a release. Email verification still needs delivery through some provider, and operations still need a way to detect failures.

**Direct answers**

| Question                                        | Answer today                                                                                                                                                                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Can consumers register?                         | The email/password registration, confirmation and login code exists. No actual account has completed registration in this project, so the real flow remains unverified. Default Supabase mail restricts who can receive confirmation emails.      |
| Can creators register?                          | Creators use the same account system, then choose **Become a creator** and create a channel. Channel setup exists; public publishing requires operator approval, content and Stripe readiness. No operator UUID is configured.                    |
| Are Stripe subscriptions working?               | The sandbox implementation and signed webhook endpoints are configured and automated tests pass. There have been **zero real sandbox Checkout attempts or subscriptions** in the application database. A complete payment test is still required. |
| Can we charge real money?                       | No. The backend deliberately rejects live Stripe keys. The queried platform account reports charges and payouts disabled, and there are no creator Connect accounts in the app.                                                                   |
| Can someone buy inside the iPhone app?          | No. New native purchases are explicitly disabled. Existing memberships can be read by the native client, but this has not been tested on a physical iPhone.                                                                                       |
| Can creators upload?                            | Yes, the connected **web studio** has a direct-to-Mux upload implementation. A provider-level upload and protected playback were verified. The complete signed-in creator UI journey remains untested. Native upload is disabled.                 |
| Is RevenueCat required because we pay creators? | No. RevenueCat helps manage store purchases and access; it does not distribute money to creators. Whether native store billing is needed depends on the content and distribution model.                                                           |
| Can this become an Xcode/TestFlight app?        | Yes. Expo supports that path. This checkout is not ready for an immediate archive/upload: iOS identity, signing, release environment, native project/build and device testing remain.                                                             |

**What was actually verified**

- [Web preview](https://web-staging-ff99.up.railway.app/screen/auth), [API readiness](https://api-staging-4654.up.railway.app/readyz) and public catalog respond successfully.
- Both GitHub CI runs for `e2082be` completed successfully. Checks cover backend types and 13 database/API tests, frontend lint/types/domain tests, demo and connected UI tests, and iOS/Android JavaScript bundle exports.
- The database snapshot has **0 users, 0 verified users, 0 creators, 0 workouts, 0 creator billing accounts, 0 Checkout attempts, 0 subscriptions and 0 payment ledger entries**. This is why a deployed API cannot yet be described as a fully tested marketplace.
- Supabase's applied schema has 17 application tables with RLS. Database TLS verification is enabled. Authenticated ownership and payment access rules have automated coverage.
- Mux credentials and signing keys are installed. A temporary three-second clip uploaded and processed; signed HLS returned 200 and unsigned HLS returned 403. Real Mux notifications completed in the hosted worker. The clip was removed afterward. This test did not exercise the app's signed-in upload form or a paid member's playback route.
- Both Stripe webhook destinations are enabled in test mode. Their secrets accepted signed synthetic events at the hosted endpoint. This is **signature/transport evidence, not a completed Stripe purchase**.
- Native subscription SDKs are absent; `/webhooks/revenuecat` returns 503 intentionally. The saved RevenueCat Test Store key is not an active integration.
- No EAS configuration, generated `ios/` project or configured iOS bundle identifier exists in this checkout. Installed Xcode is **26.0.1**. No signed archive or TestFlight upload was produced by this work. An existing App Store Connect record or paid developer enrollment has not been verified.

**Readiness ranking**

Scores describe evidence, not percentage completion or an estimate of remaining time: **0** absent/disabled; **1** scaffolding or unconfigured; **2** implemented but the real journey is unproven; **3** configured and covered by automated tests; **4** a critical live path has passed; **5** complete acceptance and operational readiness.

| Area                               | Score / 5 | Main reason it is not ready                                                                              |
| ---------------------------------- | --------- | -------------------------------------------------------------------------------------------------------- |
| Hosted API/database foundation     | 4         | Real connectivity passes; production isolation, restricted runtime DB role and restore rehearsal remain. |
| Mux provider integration           | 4         | Real upload/webhook/signed playback passes; app-level creator/member acceptance remains.                 |
| Web creator studio                 | 2         | No actual creator, approved channel or completed Connect onboarding.                                     |
| Consumer registration and accounts | 2         | No verified real account journey; recovery and persistent browser sessions are unfinished.               |
| Web Stripe subscriptions           | 2         | No actual app Checkout, renewal, cancellation or refund rehearsal.                                       |
| Creator earnings/payout operations | 1         | Ledger and payout display exist; no creator settlement or payout has occurred.                           |
| Native video uploads               | 0         | Explicitly directs creators to the web studio.                                                           |
| Native purchases and restore       | 0         | No store catalog, purchase SDK, restore flow or active RevenueCat reconciliation.                        |
| TestFlight packaging               | 1         | JS exports pass, but app identity, signing and an iOS archive are missing.                               |
| Public launch operations           | 1         | Account deletion, moderation, policies, commercial settings and production acceptance remain.            |

Do not average these scores. A missing payment or release gate can block launch regardless of how complete the interface looks.

**Signup and roles**

Consumers and creators do not need separate authentication systems. One verified Supabase account can consume workouts and own a creator channel. The server enforces channel ownership, and creator publishing requires a separate operator decision. A person choosing “creator” must never thereby receive administrator access.

The normal paths are:

1. Consumer: Create account → confirm email → sign in → browse a published coach → join on the web → wait for verified payment access → watch/save/complete workouts.
2. Creator: Create account → confirm email → Become a creator → claim handle → complete profile → create free and paid workouts → set price → complete Connect onboarding → obtain approval → publish channel.

Even with Resend excluded, **unrestricted public signup is not enabled by default Supabase email**. Supabase's built-in sender only delivers to project-team addresses and is intended for limited testing. Any supported custom SMTP provider can solve this; Resend specifically is optional. Do not disable email verification to make the demo appear complete. [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp)

Other account gaps: no forgot-password/reset flow, no implemented verified email-change flow, no confirmation resend control, and browser sessions are memory-only. A reload or returning to a new browser tab may require signing in again, including after Checkout or Connect onboarding. Native sessions use SecureStore, but persistence/refresh needs device testing.

Evidence: [authentication UI](https://github.com/TayoAki/TrainWithv1/blob/e2082be/src/connected-auth.tsx), [session storage](https://github.com/TayoAki/TrainWithv1/blob/e2082be/src/backend.ts), [server commands and publish checks](https://github.com/TayoAki/TrainWithv1/blob/e2082be/backend/src/catalog.ts).

**Stripe, creator money and RevenueCat**

The implemented web model is one monthly membership per coach. Checkout constructs the price and creator destination on the server. The Stripe subscription sets `transfer_data.destination` to that creator's Connect account and an application fee for TrainWith. The current fee is **0% for sandbox testing**, not an approved business model.

| Component               | Its job                                                                        | What it does not establish                                 |
| ----------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Stripe Checkout/Billing | Web subscription purchase and recurring billing                                | Native store purchase support                              |
| Stripe Connect          | Creator onboarding, payment routing and connected-account payouts              | Exemption from App Store purchase rules                    |
| Apple StoreKit          | Apple in-app purchase transactions                                             | Automatic creator revenue splitting                        |
| RevenueCat, if chosen   | Store purchase integration, subscription status, restore and access management | A creator payout processor                                 |
| TrainWith backend       | User/coach access, ownership, financial records and reconciliation             | Proof that a provider's money has reached a creator's bank |

RevenueCat is optional: StoreKit can be integrated directly, with more subscription infrastructure to maintain. RevenueCat wraps store billing systems; the payment processor/store pays the developer account. It does not reroute Apple receipts into the existing Stripe subscription's creator destination. An Apple purchase therefore needs a separate creator-earnings calculation, reconciliation and supported payout process. [RevenueCat overview](https://www.revenuecat.com/docs/welcome/overview), [RevenueCat store payments](https://www.revenuecat.com/docs/platform-resources/developer-store-payments), [Apple subscriptions](https://developer.apple.com/app-store/subscriptions/)

**Apple classification matters.** My assessment is that TrainWith sells recorded digital video access, rather than real-time one-to-one training. Creator revenue sharing does not change that. Apple's default rule covers digital unlocks; US storefront apps currently have external-purchase-link flexibility, while other storefronts have different restrictions/exceptions. The one-to-one fitness-service exception does not describe the recorded workout library. A universal Stripe purchase button would therefore be the wrong assumption. [Apple payment and creator-content rules, 1.2.1 and 3.1](https://developer.apple.com/app-store/review/guidelines/)

A video-first, consumption-only reader-app model may be an option, but eligibility is not established merely by including a video player. Reader-app account-link entitlements have specific eligibility and configuration conditions. Do not assume the current app is already approved for that route. [Apple reader-app requirements](https://developer.apple.com/support/reader-apps/)

**Recommended decision:** use the existing Stripe web flow for the first controlled sandbox beta. Keep native purchases disabled for initial internal TestFlight validation. Before paid public iOS distribution, choose either a supported storefront-specific external-purchase/reader approach or native store billing. For broad native paid distribution, RevenueCat is a reasonable implementation choice alongside Stripe Connect, rather than a replacement for Connect. The intended countries and product model must drive that choice.

There is a significant catalog issue: users may subscribe to several different coaches. Apple permits only one active subscription per subscription group. Independent coach memberships need a deliberate product/group design; copying every coach into one shared group would prevent the intended concurrent memberships. Prices/products must be provisioned in the store catalog and mapped to coach IDs; a creator's arbitrary web price cannot simply become an Apple product. A TrainWith-wide subscription would simplify the catalog, but would change the business model and is not assumed here. [Apple subscription-group guidance](https://developer.apple.com/app-store/subscriptions/)

If RevenueCat is selected, remaining work includes its native SDK, Apple store credentials and products, offerings, stable Supabase-user identity mapping, coach-scoped access mapping, verified webhooks, server-side playback authorization, restore/manage flows, refunds/expiry/grace-period handling and creator settlement. A single global “pro” entitlement would not represent the current per-coach model. The Test Store key alone does none of this. [RevenueCat Expo integration](https://www.revenuecat.com/docs/getting-started/installation/expo), [RevenueCat entitlements](https://www.revenuecat.com/docs/getting-started/entitlements)

**How creators upload today**

Use the [TrainWith web preview](https://web-staging-ff99.up.railway.app), not the Mux dashboard, for normal creator work:

1. Sign in, choose **Become a creator**, create a channel and open its studio.
2. In content/workouts, choose **Upload** → **Choose video and upload**.
3. Choose one video. The current picker enforces a 5 GB limit; the backend accepts publishable videos up to three hours. Keep the browser tab open.
4. The app saves a draft, requests an owner-authorized direct-upload URL, and sends the file to Mux in chunks. API credentials remain on the server.
5. Mux processing events update the video state. Open the workout editor and use **Refresh video status** until ready.
6. Complete title, description, equipment and level; choose **Free sample** or **Members only**, then publish the workout.
7. Publish the overall channel only after profile, at least one ready published free workout, one ready published paid workout, price, Connect readiness and operator approval are complete.

Current limitations: no iPhone upload implementation, no upload continuation after closing the tab, no automatic processing-status polling, and limited failure guidance. Timed-out/canceled direct-upload events are not explicitly reflected in the workout status; pending uploads can temporarily occupy the three-upload quota, though that quota excludes entries older than two hours. Add clear failed/retry states and cleanup for abandoned/replaced media. Large-video, interruption and Safari tests remain.

Evidence: [web upload implementation](https://github.com/TayoAki/TrainWithv1/blob/e2082be/src/upload-remote.web.ts), [native upload stub](https://github.com/TayoAki/TrainWithv1/blob/e2082be/src/upload-remote.ts), [upload screen](https://github.com/TayoAki/TrainWithv1/blob/e2082be/src/connected-upload.tsx), [upload limits](https://github.com/TayoAki/TrainWithv1/blob/e2082be/backend/src/app.ts#L220), [Mux event handling](https://github.com/TayoAki/TrainWithv1/blob/e2082be/backend/src/events.ts#L239).

**Ranked remaining work**

P0 blocks the named next milestone. P1 is required before the stated broader release. P2 is an improvement unless explicitly included in the launch promise. The order below is the recommended execution order, not a declaration that later items are optional.

| Rank | Priority and gate               | Work                                                                                                                                                                                                                                  | Completion evidence                                                                                                                            |
| ---- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | P0 — usable closed beta         | Complete real creator and consumer registration; select a verified operator UUID and configure `ADMIN_USER_IDS`; provide an approval workflow. Confirm email delivery for intended testers.                                           | Two separate verified accounts; owner can create/edit; consumer cannot edit; authorized operator can approve; other users cannot.              |
| 2    | P0 — working marketplace beta   | Add licensed free/paid workouts through the real studio, complete sandbox Connect onboarding, approve and publish the coach.                                                                                                          | A discoverable real channel; free playback works; unpaid users cannot watch paid videos.                                                       |
| 3    | P0 — subscription claim         | Run actual app Checkout with a test card, verify Connect routing, payment webhook, entitlement, renewal, cancel/resume and refund/dispute behavior. Confirm duplicate requests and delayed events do not duplicate charges or access. | Stripe objects, application ledger and access agree for a creator and consumer on separate sessions/devices.                                   |
| 4    | P0 — native paid release design | Choose launch storefronts and the Apple purchase model; design simultaneous per-coach subscriptions, product mapping and creator settlement.                                                                                          | Documented model; store catalog plan; appropriate native purchase/restore or external-purchase implementation.                                 |
| 5    | P0 — TestFlight delivery        | Configure bundle ID, Apple team/app record, release variables, signing and build number; create and test a signed iOS build.                                                                                                          | App launches from TestFlight without Metro, connects to Railway, and passes the device checklist below.                                        |
| 6    | P1 — public account usability   | Implement password recovery/resend, verified email changes and persistent web sign-in; test native session lifecycle and payment return paths.                                                                                        | Recovery, reload, relaunch, logout/account switch and expired-token journeys pass.                                                             |
| 7    | P1 — public/App Review          | Add an in-app account deletion flow, linked privacy/terms/support information and accurate store privacy/age disclosures. Define deletion of creator videos and handling of active memberships.                                       | Deletion can be initiated in-app without requiring a generic support request; deletion and retention behavior is tested.                       |
| 8    | P1 — public creator platform    | Add content/user reporting, blocking, moderation intake/actions, response ownership and rights checks.                                                                                                                                | Report/block flows work and an operator can remove offending content or restrict a creator.                                                    |
| 9    | P1 — real money                 | Activate/verify platform and creator payment readiness; decide fees, refunds, taxes, supported countries/currencies and payout responsibilities; introduce a reviewed live-mode configuration.                                        | Approved commercial settings, separate live credentials/webhooks and a controlled live acceptance check. Changing a key alone is insufficient. |
| 10   | P1 — production operations      | Separate production from staging, use a restricted runtime DB role, rotate temporary/shared secrets, test backup restoration and provider reconciliation, and assign incident/support ownership.                                      | Restore rehearsal, privilege checks and documented failure/recovery procedures. Monitoring can use tools other than Sentry.                    |
| 11   | P1 — reliable uploads           | Handle timeout/cancel/error states, retries and abandoned media; test large files, Safari and replacement/deletion races.                                                                                                             | A failed upload has a clear recovery path and no persistent unusable draft or unexpected retained media.                                       |
| 12   | P2, or P0 if promised at launch | Implement native creator uploads, richer studio controls, cover-image hosting, pagination, accessibility refinement and optional analytics.                                                                                           | Device upload and interruption tests if shipping native uploads; otherwise clearly scope version one to web publishing.                        |

The existing account-deletion support notice is not a completed deletion feature. Apple generally requires apps that create accounts to let users initiate deletion in-app; ordinary apps should not require a support flow. [Apple account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/)

Creator content also needs reporting, blocking, moderation and accessible contact information under Apple's user-generated-content rules. Existing operator approval and a generic support form are only part of that requirement. [Apple guideline 1.2](https://developer.apple.com/app-store/review/guidelines/#user-generated-content)

The current money model also needs economic review: it uses monthly USD prices, a US default for new Connect accounts and a 0% sandbox platform fee. Recorded gross receipts are not a creator's available payout balance. Establish who bears processing costs, refunds, disputes and store fees before promising creator earnings. This is a product/settlement decision, not a missing API key.

**Xcode and TestFlight: feasible, but not ready to upload as-is**

An Apple account is not necessarily an active Apple Developer Program membership. Confirm enrollment, the correct team and App Store Connect access. [Apple enrollment](https://developer.apple.com/programs/enroll/)

This Mac has Xcode 26.0.1. Expo SDK 57 documents Xcode **26.4+** and iOS **16.4+**. Upgrade to a compatible Xcode for local builds or use a compatible EAS cloud build image. The project enables iPad support, so include iPad testing or deliberately revise that scope. [Expo SDK 57 compatibility](https://docs.expo.dev/versions/v57.0.0/)

Before either build route:

- Choose an owned, permanent `ios.bundleIdentifier`; configure app version/build number and signing team. Do not invent an identifier already claimed by someone else.
- Create/verify the matching App Store Connect app record and signing credentials.
- Configure the **build's** public Supabase values and hosted URLs. Railway variables do not automatically propagate into an iPhone binary. The current local frontend environment points the API to localhost and has no explicit web origin; it must not be used unchanged for TestFlight.
- Keep `EXPO_PUBLIC_DEMO_MODE=false`. Never put database passwords, Stripe secret keys or Mux API/signing secrets in native public variables.
- Validate encryption/export-compliance declarations and the app's actual privacy disclosures. Provide beta notes and working review/test credentials where required.

Build-time targets for the first staging binary:

```dotenv
EXPO_PUBLIC_DEMO_MODE=false
EXPO_PUBLIC_API_URL=https://api-staging-4654.up.railway.app
EXPO_PUBLIC_WEB_URL=https://web-staging-ff99.up.railway.app
EXPO_PUBLIC_SUPABASE_URL=https://iukyxcswtuufrmxnkfwz.supabase.co
# Also supply the existing Supabase publishable key through build configuration.
```

**Xcode route:** after the preceding setup, run `npx expo prebuild --platform ios`, open the generated `ios/*.xcworkspace`, select the correct team/signing and a generic iOS device destination, then **Product → Archive → Distribute App → App Store Connect → Upload**. Manage the processed build and testers in App Store Connect. Generating a native project or passing a JavaScript export is not an archive/signing test. [Expo local release-build guide](https://docs.expo.dev/guides/local-app-production/)

**EAS route, recommended for the first build:** link/configure the Expo project, add a store-distribution profile in `eas.json` with the staging public variables and appropriate SDK 57 build image, then build and submit. A profile named `testflight` is proposed below; it does not exist yet.

```sh
# Run only after the app identity, profile and build environment are configured.
npx eas-cli@latest build --platform ios --profile testflight
npx eas-cli@latest submit --platform ios --latest
```

A development-client or ad-hoc “internal distribution” build is not the same artifact as a store-signed TestFlight build. EAS can build and upload without installing a new local Xcode. [Expo TestFlight guide](https://docs.expo.dev/submit/testflight/), [Expo store builds](https://docs.expo.dev/deploy/build-project/)

Start with internal TestFlight testers. Apple supports up to 100 internal App Store Connect users and up to 10,000 external testers; external distribution can require Beta App Review. Uploading to TestFlight does not itself release the app publicly or establish App Store approval. [Apple TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)

**Minimum acceptance before inviting testers**

| Journey                        | Required result                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Fresh install and registration | Hosted backend reached; confirmation and login succeed; clear network/auth errors.                    |
| Creator ownership              | Creator A cannot view private earnings or change Creator B's content.                                 |
| Publish and discovery          | Approved, ready channel appears; drafts and unapproved channels stay private.                         |
| Real web upload                | Creator's actual file uploads/processes, appears in the editor and plays through the app.             |
| Payment and access             | Successful sandbox payment unlocks only the chosen coach; declined/canceled payment unlocks nothing.  |
| Subscription lifecycle         | Renewal failure, cancellation, restoration of access and refund match server/payment state.           |
| Multiple memberships           | Independent coach access remains independent; no accidental global unlock.                            |
| iPhone playback                | Signed HLS, seeking, foreground/background return, token renewal and interrupted network work.        |
| Account lifecycle              | Relaunch, reload, logout, account switching, recovery and deletion behave as documented.              |
| Hosted recovery                | Duplicate/delayed webhooks and worker restart preserve correct access and ledger state.               |
| Store billing, if included     | Apple sandbox purchase, restore, expiration/refund and account mapping work on a signed device build. |

**Recommended next milestone:** a controlled web beta with one approved creator, one independent consumer, real free/paid videos and a completed sandbox payment lifecycle. Then ship a clearly scoped internal TestFlight build. Add the selected native payment model and public-launch requirements before calling the app complete.

This review creates a release plan; it does not create users, enroll an Apple account, change the payment model or submit a build. The infrastructure runbook remains [backend setup](https://github.com/TayoAki/TrainWithv1/blob/e2082be/docs/setup/BACKEND.md).
