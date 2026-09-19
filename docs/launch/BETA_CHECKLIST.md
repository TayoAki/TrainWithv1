# TrainWith beta checklist

Created 19 September 2026 from the [readiness review](READINESS_REVIEW_2026-09-19.md). This is the working task list; unchecked items still need implementation or verification.

**First milestone:** a private web beta with real accounts, creator-owned videos and Stripe sandbox payments. Then distribute an internal TestFlight build for mobile testing. Suggested first group: 1–2 creators and 3–5 consumers, invited after the relevant checks pass.

**Beta scope:** creators upload through the web studio; consumers test discovery, memberships and playback. No real charges or payouts. Native purchases remain disabled. Resend and Sentry remain paused; verification email delivery and an assigned support contact are still needed.

Owners below are proposed responsibilities: **You** supplies business/account decisions and content; **Development** implements and verifies; **Together** runs acceptance tests. Check a task only when its acceptance result has evidence, with the environment, commit/build and test date recorded.

## Already in place

- [x] Railway staging web and API are deployed and connected to Supabase.
- [x] Account, creator, membership and authorization code is implemented, with automated backend and UI checks.
- [x] Stripe sandbox Checkout, Connect and webhook integrations are implemented. Actual app checkout still needs testing.
- [x] Mux credentials, direct uploads, webhooks and signed playback are configured. A provider-level video test passed; the signed-in creator journey still needs testing.

These checks describe infrastructure and implementation, not completed user journeys. At the readiness review, the application had no registered users, creators, workouts or subscriptions, and no native archive had been built.

## 1. Prepare the first accounts and content

- [ ] **B01 — You:** Choose the TrainWith app login email for the operator, plus the first creator and independent consumer test accounts. Register and verify the accounts; dashboard logins do not create app accounts. Keep passwords out of this checklist.
- [ ] **B02 — Development:** Configure verification email delivery for the intended testers and prove a fresh signup can receive its code/link and sign in. Supabase's default sender is restricted; choose a suitable SMTP provider if needed. Do not give testers project-admin access to work around delivery limits. Resend is optional.
- [ ] **B03 — Development:** Add the verified operator's user ID to `ADMIN_USER_IDS`. Prove the operator can review/approve a creator and an ordinary user cannot perform admin actions.
- [ ] **B04 — You:** Supply a creator name, handle, bio, profile artwork, sandbox monthly price, and at least one free and one members-only workout video you have rights to use. Add a second creator for cross-creator access tests.

## 2. Prove the web beta works

- [ ] **B05 — Together:** Complete creator signup, profile and Stripe **test** Connect onboarding. Confirm the sandbox account meets the app's publishing checks. Record any onboarding or verification errors.
- [ ] **B06 — Together:** Upload the real free and paid workouts through the signed-in web studio, wait for processing, edit metadata and publish. Approve and publish the channel; prove it appears in discovery while drafts and unapproved channels remain private.
- [ ] **B07 — Development:** Test interrupted/failed uploads and retry, including Safari and a larger file. Fix states that leave a creator without a clear recovery path; verify abandoned/replaced media handling. Native upload stays clearly labeled as unavailable.
- [ ] **B08 — Together:** As an independent consumer, play the free workout and confirm the paid workout is locked. Complete an actual sandbox Checkout through the app; return, sign in again if required, refresh membership and play the paid workout. Save the Checkout/subscription IDs as evidence.
- [ ] **B09 — Development:** Verify canceled and declined Checkout do not grant access. Test renewal, failed renewal, cancellation at period end, resuming a canceling subscription, expiration and refund. Confirm access and earnings records match the provider's state without duplicate ledger entries.
- [ ] **B10 — Development:** Test two independent creator memberships. Paying Creator A must not unlock Creator B; refunding or expiring one must not remove the other. Verify a creator cannot edit another creator's videos or read private earnings, including direct API requests.
- [ ] **B11 — Development:** Verify webhook retries, duplicate/delayed events and worker restart preserve correct membership and video state. Prove unsigned playback URLs and unauthorized playback requests fail.
- [ ] **B12 — Development:** Test logout, account switching, browser reload and Checkout return. Resolve or explicitly document the current web session loss on reload. Provide a tested password-recovery route for the beta; never silently fall back to demo data on errors.

**Web invitation gate:** B01–B12 pass, there are no unresolved security/payment/access failures, and each tester can finish the intended journey. If a nonessential issue is accepted, record its impact and workaround before inviting testers.

## 3. Package and test the iPhone beta

- [ ] **B13 — You:** Confirm an active Apple Developer Program membership, signing team and App Store Connect access. Choose the permanent bundle identifier and confirm the TrainWith app record. An Apple login alone is insufficient.
- [ ] **B14 — Development:** Configure app identity, version/build number, signing and an EAS **store-distribution** profile. EAS is the recommended first build route; local Xcode is an alternative after upgrading to the version required by Expo SDK 57. The audited Mac's Xcode 26.0.1 is below that requirement.
- [ ] **B15 — Development:** Configure native build variables with the hosted staging API/web URLs and Supabase public values, with demo mode off. Confirm no localhost URLs or server secrets are bundled. Railway variables do not automatically configure a native build.
- [ ] **B16 — Development:** Produce a signed iOS archive, upload it to App Store Connect, resolve processing issues and install it through internal TestFlight. Record the build number. A successful JavaScript export does not satisfy this task.
- [ ] **B17 — Together:** On physical devices, test fresh install, verified signup/login, app relaunch, account switching, free and paid playback, seeking, background/foreground return, expired video tokens and interrupted networking. Include iPad while the app declares iPad support.
- [ ] **B18 — Development:** Verify the native beta clearly explains its limits: creator uploads happen on web and new native purchases are disabled. Existing sandbox memberships must load and authorize playback correctly. RevenueCat is not required for this limited beta.

**Internal TestFlight gate:** B13–B18 pass and the web acceptance checks remain valid for the backend used by that build. Internal testers must have appropriate App Store Connect access; ordinary customers belong in an external testing group when it is ready.

## 4. Run a controlled test round

- [ ] **B19 — Together:** Set the tester roster, test dates, feedback channel and named support owner. Give testers the web URL/build number, expected journeys and known limitations. Explain that all billing is sandbox-only.
- [ ] **B20 — Together:** Have each creator complete profile → upload → publish, and each consumer complete signup → free playback → locked content → sandbox subscription → paid playback → cancellation. Repeat native-supported steps on TestFlight. Collect results rather than relying on “looks good.”
- [ ] **B21 — Development:** Triage issues, fix blockers and repeat the affected journeys against the candidate release. Freeze the tested commit/build and record a go/no-go decision before widening the group.

Use this issue template:

```text
Title / severity:
Environment / commit or build / date:
Device / OS / browser:
Role and steps to reproduce:
Expected result / actual result:
Screenshot or relevant request/event ID (no passwords or tokens):
Owner / status / workaround:
Retest result and build:
```

**P0:** unauthorized access, payment/access corruption, data loss or an app-wide outage — stop the affected testing immediately. **P1:** a core signup, upload, purchase or playback journey cannot finish — fix before widening the beta. **P2:** an issue with a usable workaround or cosmetic defect — track with an owner. No open P0 or core-journey P1 issues at a release gate.

## 5. Before external TestFlight or a paid public launch

- [ ] **B22 — Development:** Implement in-app account deletion, account recovery/resend flows, accessible privacy/terms/support pages, and content/user reporting, blocking and moderation. Verify deletion and moderation outcomes, not just the presence of buttons.
- [ ] **B23 — Together:** Prepare beta review information, working review credentials, privacy and export-compliance declarations, and external TestFlight review where required. Decide which countries/storefronts the beta supports. Follow the [release and policy guidance in the readiness review](READINESS_REVIEW_2026-09-19.md).
- [ ] **B24 — Together, before native paid sales:** Choose the store billing/access model for the intended storefronts. If using in-app purchases, implement and test purchase, restore, refund/expiry and per-creator entitlements. RevenueCat is optional tooling for store billing; it does not pay creators. Define creator settlement for store proceeds separately from Stripe web payments.
- [ ] **B25 — Together, before real money:** Agree fees, countries, taxes, refunds and payout responsibility; activate payment readiness; create separate production configuration and complete controlled live acceptance. The app currently rejects live Stripe keys, so replacing a key is not sufficient.
- [ ] **B26 — Development, before production:** Restrict the runtime database role, separate production from staging, rotate temporary/shared credentials, test backup restoration and establish alerts, support and reconciliation procedures. Sentry is optional; operational ownership is not.

## Links and evidence log

- [Web staging](https://web-staging-ff99.up.railway.app/screen/auth)
- [Railway project](https://railway.com/project/c5175ac7-0da8-4a7d-90cf-560b944fc091)
- [Backend setup and runbook](../setup/BACKEND.md)
- [Full readiness review and official sources](READINESS_REVIEW_2026-09-19.md)

| Task    | Environment / commit or build | Evidence and result                                                                            | Tested by / date |
| ------- | ----------------------------- | ---------------------------------------------------------------------------------------------- | ---------------- |
| B01–B26 | Pending                       | Add a row when each task is verified; do not store credentials or private tester details here. | —                |
