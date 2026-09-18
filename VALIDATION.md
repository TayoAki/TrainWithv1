# TrainWith frontend validation

## Passed

- TypeScript strict type check, with no `any` in the codebase.
- ESLint (eslint-config-expo) and Prettier: clean.
- Expo Doctor: 19/21 project checks. See "Environment-limited checks" below.
- Production Expo web export.
- iOS and Android JavaScript/Hermes exports (compilation, not installed native builds).
- Ten domain tests covering the pure transitions in `src/services.ts`:
  creator-scoped membership access and expiry, handle availability and reserved
  names, channel publication requirements, one-month membership periods and
  replacement, cancel-keeps-access, first-completion-wins and clearing,
  handle claim then rename, workout upsert, both payment gateway outcomes, and
  the shared email check against valid and malformed addresses.
- Twelve JSDOM interaction groups against the production Expo web bundle:
  1. Application mount and discovery.
  2. Search, channel navigation, program detail and saving.
  3. Free workout completion and undo.
  4. Payment failure/retry, membership activation, unlocking and completion.
  5. Canceling and resuming renewal.
  6. Creator onboarding, duplicate-handle validation and disabled launch action.
  7. Creating and publishing free/member workouts.
  8. Building and publishing an ordered program.
  9. Pricing, payout setup and publishing the channel.
  10. Joining that channel updates creator members and earnings.
  11. Support requests remain local.
  12. Workflow results are written to device storage.
- Run script shell syntax and help.
- Bundled photo assets and a valid 30-second H.264 sample video.
- Real-browser smoke pass, including an accessibility check. See "Browser pass" below.

Machine-readable interaction results: `tests/latest-result.json`.

## Browser pass

Run against `npm run web` (Expo dev server, `http://localhost:8081`) in headless
Chromium 141.0.7390.37 driven by Playwright 1.56.1, at a 420x900 mobile viewport
and a 1440x900 desktop viewport.

Verified:

- The app boots and paints in a real engine, not only JSDOM.
- Mobile layout: heading, search field, category chips, stacked coach cards, and
  the bottom tab bar (Discover / My workouts / Profile).
- Desktop layout: the responsive breakpoint switches to the left sidebar shell
  with a three-across coach grid.
- Bundled photos decode and render. `src/data.ts` stores Unsplash URLs as lookup
  keys that `src/ui.tsx` maps to local `assets/photos/*.jpg`, so images resolve
  with no network access.
- Navigation and routing: tapping a coach card pushes the root handle route
  `/trainwithmaya`, which renders the cover, tagline, Workouts/Programs/About
  tabs, the free-sample and member workout lists, and the join call to action.
- Both `/` and `/trainwithmaya` return 200 when requested directly, so the
  client-side routes serve on reload.
- Console and page errors: zero, at both viewports.

The zero-error result is post-fix. Before the fix below, every screen logged
`Unexpected text node: . A text node cannot be a child of a <View>.` and
displayed a red development overlay that covered the bottom tab bar.

### Fixed during this pass

Notice guards short-circuited on string state initialized to `""` — the store's
`error`, the `msg` / `err` / `shareError` fields in the consumer and creator
flows, and the `""` that `handleError` returns for a valid handle. `"" && <Notice/>`
evaluates to `""`, which React keeps as a child, so react-native-web's
development check reported a text node directly under a `View`.

Sixteen guards in `src/screens.tsx`, `src/consumer.tsx`, `src/creator.tsx` and
`src/ui.tsx` now coerce with `!!` so an empty string drops out as `false`.

Scope of the defect: web development builds only. React skips empty-string
children when it builds fibers, so native and production builds were never
affected. It was cosmetic, but it obscured UI on every screen during
development. Behavior is unchanged on every platform; the full check set above
was re-run after the change.

### Accessibility checked in Chromium

Measured on the rendered page, not asserted from source:

- Colour contrast. Every text colour in the `C` palette clears WCAG AA (4.5:1)
  for normal text on the surfaces it is used on. `muted` failed before this pass
  at 3.54:1 on sage, 3.89:1 on bg and 4.14:1 on white, while carrying captions
  at 11-13px, which count as normal text. It moved from `#728077` to `#626E66`
  and now measures 4.56 / 5.00 / 5.33.
- Touch targets. Zero interactive elements render below 44x44 CSS px. The back
  button (35x35) and the header avatar (34x34) were under the minimum; chips sat
  at roughly 41. The avatar keeps its 34px circle inside a 44px pressable.
- Headings. Section titles expose `role="heading"`.
- Keyboard. Tab order runs logo, navigation, sidebar call to action, profile.
  Every stop is a real button with an accessible name and a visible focus ring.
- Form errors. Field errors are announced through `accessibilityHint` plus an
  `alert` live region, and the input carries `aria-invalid`. The accessible name
  stays the bare label.
- Responsive layout. No horizontal overflow at 390px on discovery, the public
  channel or the checkout (`scrollWidth` equals `clientWidth` on each).

Not covered: a screen reader was not run (VoiceOver/TalkBack), and reduced
motion, text scaling and high-contrast modes were not exercised.

## Production readiness

The UI is production-shaped, but the app is **not ready for real users**. What is
missing is integration, not interface:

- Sign-in accepts any name and email. There is no authentication.
- The checkout charges nothing. `localPaymentGateway` in `src/services.ts` is a
  stand-in, and the membership screen shows a clearly labelled payment sandbox
  control that must be deleted when a real provider is wired.
- `hasAccess` in `src/data.ts` is a presentation check, not a security boundary.
  Membership authorization has to move server-side before it protects real media.
- Membership period dates are written by the client. A real backend must own them
  and handle renewals through provider webhooks.
- Payouts, support delivery and cross-device channel data do not exist.

See "Wiring a backend" in `README.md`. The seams are confined to
`src/services.ts`, so screens should not need to change.

## Not verified in this environment

The browser pass covers layout, routing and image rendering. It does **not**
cover, and these still need a device/browser acceptance pass:

- Real media decoding and playback. The browser pass never entered the player;
  media methods are stubbed in the JSDOM interaction tests.
- Native and web file-picker dialogs, and clipboard permissions.
- The full consumer and creator journeys in a real browser. Only discovery and
  the public channel were driven through Chromium; purchase, completion,
  cancellation and the creator publishing flow are covered by JSDOM only.
- Native device interaction, safe-area behavior, on-screen keyboard handling in
  forms, and app restart persistence.
- Touch input. The browser pass used synthetic clicks at a mobile viewport, not
  real touch events on a device.
- Screen readers. Accessibility semantics were checked in the DOM, but no
  VoiceOver or TalkBack pass was run.

JSDOM verifies DOM interactions and state changes; it does not replace visual or
device testing.

No App Store/Play Store build, EAS deployment, backend service, real account
authentication, purchase, payout, domain connection or external publication was
performed.

## Environment-limited checks

Expo Doctor reports 19/21 in a network-restricted container. Both failures are
outbound access, not project defects:

- "Check Expo config (app.json/app.config.js) schema" cannot reach `exp.host`.
  The reported `SyntaxError: Unexpected token 'H', "Host not i"...` is a proxy
  refusal body being parsed as JSON.
- "Validate packages against React Native Directory package metadata" cannot
  reach `reactnative.directory`.

Both pass on an unrestricted network, where the project reports 21/21. Re-run
`npx expo-doctor` outside the sandbox to confirm.

## Suggested device acceptance pass

Open with Expo Go and check the core member journey, a real local MP4 selection,
playback/pause/fullscreen, keyboard behavior in forms, safe-area layout, app
restart persistence, sharing/copy, and the creator publishing journey. On web,
check 390px and desktop widths and reload a direct channel route.
