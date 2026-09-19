# TrainWith store disclosure worksheet

Prepared 19 September 2026 from the connected app and backend. This is an operator worksheet, not submitted App Store Connect metadata. Reconcile it against the signed app, enabled SDKs/provider settings and actual business identity before submission. Apple requires disclosure of relevant third-party collection as well as the app's own collection. [Apple privacy guidance](https://developer.apple.com/app-store/app-privacy-details/)

## Selected initial release

- Free download; paid creator memberships are a separate product.
- United States iOS storefront only, external Stripe Checkout in the system browser. Unknown/non-US storefronts and Android have no purchase links. No RevenueCat dependency is required for this model. [Apple US guidance](https://developer.apple.com/news/?id=9txfddzf), [Stripe iOS guide](https://docs.stripe.com/mobile/digital-goods/checkout)
- Adults 18+. Complete the current age questionnaire accurately for user/creator content, fitness, moderation and age assurance; do not infer the official store rating solely from our adult gate.
- Stripe sandbox, web-only creator uploads, Resend/Sentry paused.

## Public links and identity

| Store field                  | Candidate value / remaining action                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Privacy policy               | https://web-staging-ff99.up.railway.app/screen/privacy — replace with the stable production URL at public launch          |
| Support URL                  | https://web-staging-ff99.up.railway.app/screen/contact                                                                    |
| Terms                        | https://web-staging-ff99.up.railway.app/screen/terms                                                                      |
| Account deletion             | Settings → Delete my account, also accessible from Privacy policy                                                         |
| Legal operator               | Set `LEGAL_OPERATOR_NAME` to the actual responsible person/company; not provided yet                                      |
| Public privacy/support email | Set `SUPPORT_EMAIL`; not provided yet                                                                                     |
| App Store availability/price | Set United States and Free in App Store Connect; not yet configured/verified                                              |
| Review account               | Provide a working verified adult consumer and creator account with licensed approved content; keep credentials out of Git |

## Data inventory to map to the questionnaire

The following are code-derived recommendations. App functionality is the primary purpose and these records are generally linked to an account. Do not select “Data Not Collected.” No targeted advertising or cross-company advertising tracking is implemented.

| Data                                      | Actual handling                                                                                       | Candidate disclosure                                                                                                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name, email                               | Supabase Auth, app profile, support; creators see their member names                                  | Contact Info: Name, Email; linked; app functionality                                                                                                                 |
| User ID/creator handle, customer IDs      | Authentication, ownership, memberships, abuse controls                                                | Identifiers: User ID; linked; app functionality                                                                                                                      |
| Membership/payment history                | Subscription periods, prices, receipts/refunds; Stripe and private ledger                             | Purchases: Purchase History; linked; app functionality                                                                                                               |
| Creator earnings/payout records           | Private Stripe/ledger amounts displayed in Studio                                                     | Financial Info: Other Financial Info; linked; app functionality                                                                                                      |
| Workout completions/saved programs        | Account training history and saved items                                                              | Health & Fitness: Fitness; Usage Data/Product Interaction as applicable; linked; app functionality                                                                   |
| Creator profile, workout/program metadata | Public approved content; private drafts and moderation                                                | Other User Content; linked; app functionality                                                                                                                        |
| Creator photos/videos                     | HTTPS profile images and Mux uploads; native uploads currently unavailable                            | Photos or Videos as applicable to the release's collection paths; linked; app functionality; confirm whether web-only collection is outside the native label's scope |
| Reports/contact/support                   | Private message/email and moderation outcome                                                          | Customer Support / Other User Content; linked when signed in; app functionality                                                                                      |
| Adult eligibility                         | Adult confirmation, source, policy version and timestamp; no full DOB stored                          | Map to the current age-related/Other Data category offered in App Store Connect; linked; app functionality                                                           |
| Service logs and delivery metadata        | Railway/Supabase/Mux/Stripe request, security and delivery information                                | Audit actual retained identifiers and diagnostics with each provider; include applicable diagnostics/usage categories and purposes                                   |
| Payment instruments/creator verification  | Entered in Stripe-hosted browser pages; app stores provider IDs, not card numbers or bank credentials | Evaluate Apple's off-app payment exception against actual developer access/provider setup; do not blindly declare no financial collection                            |

No HealthKit, contact book, precise-location, advertising-ID or Sentry collection is implemented. Search is local catalog filtering, not a stored search-history feature. The Mux Data environment value is saved configuration but no Mux analytics SDK is initialized in this release; review again if analytics is enabled. Provider delivery/security logs still exist.

## Signed-build and operational checks

1. Verify the archive's privacy manifests and required-reason APIs for Expo, AsyncStorage, SecureStore, FileSystem and all transitive SDKs. Generate the privacy report and reconcile it with these answers.
2. Test iOS 26+ Apple age range: adult, under-18, declined and unknown. Check the declared-age-range entitlement/provisioning. Older iOS and web use explicit self-declaration, not verified identity.
3. Test US, non-US, unavailable and changed StoreKit storefronts; sandbox purchase, cancel, return and authoritative membership refresh. Confirm the external transaction disclosure and subscription terms are visible.
4. Assign an operator to review reports/contacts daily, prioritize harmful content, record actions, and respond to users. The inbox alone is not staffing. No automatic email replies or incident alerts are enabled.
5. Set a concrete retention schedule for financial/security records and backups with the operator, verify access/export handling and provider deletion behavior, and update the policy to match actual operations before public launch.
6. Test account deletion with real disposable creator media and sandbox subscriptions, including provider outages. Removal must not be described as complete while a provider step is pending.
7. Complete age rating, export compliance, app price/availability, beta review notes and review credentials in App Store Connect. The current app has not been submitted or approved.

The implementation reduces the identified product gaps; it does not certify every applicable state law or guarantee App Review approval. [Apple creator-content requirements](https://developer.apple.com/app-store/review/guidelines/#user-generated-content)
