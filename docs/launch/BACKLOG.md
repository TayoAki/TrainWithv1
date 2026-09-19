# TrainWith implementation backlog

Proposed work, September 19, 2026. Nothing in this list has been implemented by the planning task. IDs are local planning references, not GitHub issues. Use the [launch plan](LAUNCH_PLAN.md) for architecture, sequencing, and assumptions.

**P0** blocks any real paid beta. **P1** blocks the named public/native release. **P2** is post-launch. Engineering owns implementation unless another owner is named. Each item includes a concrete completion test; a screen that only looks complete does not satisfy it.

## Foundation and product decisions

| ID    | Priority                           | Work                                                                                                                   | Depends on          | Completion test                                                                                        |
| ----- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| TW-01 | P0                                 | Founder: confirm entity, launch markets/currency, domain, fee, seller model, and payout terms                          | —                   | Written decisions, supported-provider eligibility, named owners                                        |
| TW-02 | P0                                 | Establish protected release workflow, supported Node version, preview/production separation, and environment inventory | TW-01               | Repeatable CI and staging deploy; previews cannot read production secrets/data                         |
| TW-03 | P0                                 | Triage dependency advisories and choose compatible remediation                                                         | —                   | Reachability assessment plus fixes or explicit bounded risk decisions; no accidental SDK downgrade     |
| TW-04 | P1 native; investigate immediately | Prove two simultaneous coach subscriptions and restoration on native                                                   | TW-01, store access | Two coaches purchased/restored with correct attribution and documented catalog/payout strategy         |
| TW-05 | P0                                 | Define API contract, database schema, migrations, and access policies                                                  | TW-01               | Clean environment builds from migrations; schema review covers ownership, billing, ledger, and content |

## Accounts and product data

| ID    | Priority | Work                                                                          | Depends on          | Completion test                                                                                                                            |
| ----- | -------- | ----------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| TW-06 | P0       | Verified email authentication, sessions, recovery, and logout                 | TW-02, TW-05        | Web + native sessions survive restart; invalid/expired sessions fail safely                                                                |
| TW-07 | P0       | Replace synchronous local store with typed server requests and per-user cache | TW-05, TW-06        | Two devices synchronize; switching accounts exposes no prior account data                                                                  |
| TW-08 | P0       | Creator ownership, unique handles, profile CRUD, public catalog               | TW-05, TW-07        | Concurrent handle claim has one winner; cross-owner edits fail server-side                                                                 |
| TW-09 | P0       | Workouts, ordered programs, drafts, saved content, progress                   | TW-08               | Unpublished records stay private; saved/order/progress changes persist across devices                                                      |
| TW-10 | P0       | Authorization, input validation, rate limits, least-privilege database roles  | TW-05 through TW-09 | Anonymous, member, other coach, and admin tests prove intended boundaries                                                                  |
| TW-11 | P0       | Account deletion/export and retention behavior                                | TW-06, TW-05        | Verified deletion removes or de-identifies appropriate records while preserving required accounting records; explains billing consequences |

## Video and launch content

| ID    | Priority | Work                                                                         | Depends on   | Completion test                                                                                              |
| ----- | -------- | ---------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------ |
| TW-12 | P0       | Authorized direct upload with progress, retry, quotas, and asset state       | TW-08, TW-10 | Real long workout uploads from supported web browsers; interruption/retry and unauthorized upload tests pass |
| TW-13 | P0       | Mux verified events and asset lifecycle jobs                                 | TW-02, TW-12 | Duplicate/failed events do not duplicate assets; abandoned and replaced assets are cleaned up                |
| TW-14 | P0       | Access-checked signed playback, token refresh, captions, seeking             | TW-13, TW-18 | Authorized member watches full lesson; forged/expired access cannot obtain a token                           |
| TW-15 | P0       | Founder/content: recruit coaches, obtain rights, prepare real lesson library | TW-01        | Approved identities, releases/music rights, accurate metadata and captions; zero sample lessons sold         |

## Web commerce and accounting

| ID    | Priority | Work                                                                 | Depends on   | Completion test                                                                                               |
| ----- | -------- | -------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------- |
| TW-16 | P0       | Connect onboarding, account capability status, restrictions          | TW-01, TW-08 | Hosted onboarding updates verified readiness; restricted accounts cannot launch sales/payouts                 |
| TW-17 | P0       | Versioned offers, server-created Checkout and billing portal         | TW-10, TW-16 | Client price tampering fails; provider creates correct recurring subscription and management session          |
| TW-18 | P0       | Durable billing events and unified per-coach access grants           | TW-17, TW-05 | Purchase, renewal, failed renewal, cancellation, refund, duplicate/out-of-order events produce correct access |
| TW-19 | P0       | Ledger, reconciliation, transfer/payout status, real studio balances | TW-16, TW-18 | Example sale/refund/dispute/payout reconciles exactly to provider records; repeated events cannot double-pay  |
| TW-20 | P0       | Lifecycle email and billing-origin aware membership UI               | TW-06, TW-18 | Verified email delivery; cancellation and billing links act on the correct provider and account               |

## Operations, integration, and web release

| ID    | Priority | Work                                                                            | Depends on          | Completion test                                                                                               |
| ----- | -------- | ------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| TW-21 | P0       | Admin approval, content reporting/blocking, takedown, audit trail               | TW-10, TW-13        | Report reaches queue; authorized operator can act; member cannot invoke admin endpoints                       |
| TW-22 | P0       | Support workflow and operator runbooks                                          | TW-06, TW-20        | Ticket is delivered, assigned, replied to, and visible to its owner only                                      |
| TW-23 | P0       | Website-to-app integration and consistent TrainWith brand                       | TW-08, TW-17        | Live CTAs and canonical channel links work; stale ZIP bundle and illustrative offers are not the live product |
| TW-24 | P0       | Founder/advisers: policies, creator terms, tax/refund process, fitness guidance | TW-01, TW-19        | Published policies match actual data/billing behavior and approved operating model                            |
| TW-25 | P0       | Monitoring, durable-job alerts, spend budgets, redaction                        | TW-02, TW-13, TW-18 | Injected upload/payment failure triggers an actionable alert without leaking sensitive data                   |
| TW-26 | P0       | Backup restoration, migration safety, rollback, incident procedure              | TW-05, TW-25        | Restore rehearsal succeeds; rollback does not destroy state or break existing clients                         |
| TW-27 | P0       | Real browser/device/security/accessibility acceptance suite                     | TW-11 through TW-26 | Critical happy and failure paths pass against staging services, beyond the local simulated tests              |
| TW-28 | P0       | Controlled production purchase/refund/payout, invite cohort                     | TW-15, TW-24, TW-27 | Authorized small live transaction reconciles; invited members can train; support and rollback are staffed     |

## Native release

| ID    | Priority  | Work                                                                          | Depends on                 | Completion test                                                                                                             |
| ----- | --------- | ----------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| TW-29 | P1 native | EAS project, permanent IDs, signing, build profiles, app links, update policy | TW-02                      | Signed preview builds install on iPhone/Android and open verified links                                                     |
| TW-30 | P1 native | Approved native purchase UX and RevenueCat integration if selected            | TW-04, TW-18, TW-29        | Purchase, restore, refund/revoke, renewal, account switch, and web/native duplication tests pass                            |
| TW-31 | P1 native | Store settlement and coach payout reconciliation                              | TW-04, TW-19, TW-30        | Documented eligible payout route and reconciliation from store proceeds to coach ledger; no assumed automatic Connect split |
| TW-32 | P1 native | Privacy declarations, deletion flow, ratings, screenshots, reviewer access    | TW-11, TW-21, TW-24, TW-30 | Store metadata accurately represents app/SDK behavior and reviewers can use the paid-content path                           |
| TW-33 | P1 native | TestFlight/Play tests, staged rollout, release monitoring                     | TW-27, TW-29 through TW-32 | Required tests and reviews completed; phased rollout can be stopped with clear ownership                                    |

## Post-launch candidates

P2: native background uploads, offline video with protected licensing, push reminders, richer analytics, annual subscriptions, multi-currency, creator teams, referrals, live sessions, chat, AI features, and wearables. Rank these from actual member/coach demand after measuring the core membership business.

## First implementation milestone

Deliver TW-01/02/05/06 and a narrow path through TW-08/12/13/16/17/18/14 in staging: one approved coach, one real uploaded video, one verified member, a provider-backed test subscription, and correctly expiring server-authorized playback. Run TW-04 in parallel as a product feasibility workstream, not as a reason to delay proving the web flow.
