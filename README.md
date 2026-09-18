# TrainWith — Expo frontend

A working frontend for a fitness creator membership app. Expo SDK 57, React Native, TypeScript, and Expo Router. Supports a native mobile layout and a responsive web layout with a desktop sidebar.

> **Not ready for real users.** The UI is production-shaped, but no backend is
> connected: sign-in accepts anything, the checkout charges nothing, payouts are
> not real, and support requests go nowhere. `hasAccess` in `src/data.ts` is a
> presentation check, not a security boundary. Wire the seams in `src/services.ts`
> to real services — and move membership authorization server-side — before this
> goes in front of anyone. No backend credentials are required to run it locally.

## Start the app

Requires Node 22.13+ (Node 24 recommended).

```sh
npm ci
npm start
```

Scan the development QR code with a compatible Expo Go release, or press `i` / `a` for an installed simulator. For a browser:

```sh
npm run web
```

Codex Run and Run Web actions are configured in `.codex/environments/environment.toml`. The executable runner also supports `--ios`, `--android`, `--tunnel`, `--dev-client`, `--export-web`, and `--doctor`. The default uses Expo Go; no native prebuild or cloud build is required.

### Run it in GitHub Codespaces

The quickest way to see the app without installing anything locally. From the
repository page choose **Code → Codespaces → Create codespace on this branch**,
then once it opens:

```sh
npm run web
```

`.devcontainer/devcontainer.json` pins Node 22 and runs `npm ci` on create, so
the codespace is ready to go. Port 8081 is forwarded automatically and opens in
a browser preview; use "Open in Browser" on the Ports tab for a full tab.

For a physical device, see "Run on a physical device" below — a codespace
cannot be reached over your LAN, but `npx expo start --tunnel` works from one.

### Run on a physical device

Expo Go needs to reach the Metro bundler. On a local machine that happens over
your Wi-Fi; from a codespace it cannot, because your phone is not on the same
network. A tunnel solves this by dialling _out_ to a public relay, so the phone
connects to a public URL instead of a LAN address — no router setup, and it
works on cellular.

```sh
npx expo start --tunnel
```

Scan the QR code with a compatible Expo Go release. `@expo/ngrok` is already a
devDependency, so there is nothing else to install. This works from a codespace
or a local machine.

If the tunnel cannot reach ngrok it exits with `ngrok tunnel took too long to
connect`; that means outbound access is blocked, which is common on locked-down
corporate networks and in sandboxed CI containers. Run locally on the same
Wi-Fi instead:

```sh
npm start
```

To view the **web** build on a phone without Expo Go, forward port 8081 from
the codespace, set its visibility to Public on the Ports tab, and open the URL
in the phone's browser. The layout is responsive down to 390px.

### Serve a built web bundle

`dist/` is a build artifact and is not committed, so generate it first:

```sh
npm run export:web
python3 script/serve_web.py
```

Open `http://localhost:8080`. Choose `--port 8090` if 8080 is occupied. Do not open `dist/index.html` directly with a `file://` URL — the routes need a server.

To preview without installing anything, download the `web-bundle` artifact from a CI run of this branch, unzip it to `dist/`, and run `script/serve_web.py` against it.

## Try the consumer flow

1. Discover → choose Maya → play a free sample.
2. Join Maya → continue to sign in → use a sample profile.
3. Optionally test payment failure in the payment sandbox, then switch to Successful payment and join.
4. My workouts → start next workout → mark complete.
5. Profile → My memberships → cancel or resume renewal.
6. Explore a program and save it, or view completion history.

Joining Maya unlocks only Maya’s channel. Canceling renewal retains access through the displayed period. Renewals are not collected automatically; that needs a payment provider. Each completion is recorded once per workout; it is a completion checklist, not a multi-session activity log.

## Try the creator flow

1. Profile → Become a creator → create a channel.
2. Choose an available handle, add a name, promise, bio, category, and cover.
3. Content → Add a workout. Select your own MP4 or use the bundled sample video. Fill in its details and publish it as a free sample.
4. Add another workout for members.
5. Optionally create a program, add published workouts, arrange their order, and publish it. Programs use a repeatable weekly session sequence.
6. Studio → set the monthly price → complete payout setup.
7. Review the checklist → publish the channel → open member view.
8. Join your own channel as a member. Return to the studio to see Members and Earnings update.

Publishing only updates local state. The planned `jointrainwith.com/handle` URLs are copyable placeholders; the domain is not connected and creator data is not shared across devices. Root handle routes work on the local app, e.g. `/trainwithmaya`.

## Local data and media

- AsyncStorage persists the profile, channel edits, memberships, saved programs, and completions.
- Web video files use IndexedDB. Native files are copied to the app’s document directory. The upload limit is 100 MB.
- Bundled photos and an original 30-second branded sample clip work without external image/video URLs. The sample is **not a fitness lesson**; workout durations are illustrative metadata. Upload real footage to try an actual workout.
- Profile → Settings → Reset app data restores the seed state. It removes references to custom videos; app/browser storage management can remove their underlying files.
- This is one device-local workspace. Switching profile does not isolate multiple accounts. Sign-out preserves the workspace.

## Included flows

**Consumer:** discovery and filters, public channel, workouts/programs/about tabs, program details, saved programs, free and locked workouts, video player, sign-in, membership offer, payment pending/failure/success, training library, complete/undo, history, profile editing, membership cancellation/resumption, local support request, and data reset.

**Creator:** start, handle validation, profile/cover, studio checklist, content library, video selection, workout editor, access controls, publish/draft, program builder and ordering, price, payout setup state, channel preview, publishing, sharing, members/search, earnings, settings, and unpublishing.

## Structure and backend handoff

- `app/`: Expo Router routes and app shell entry.
- `src/data.ts`: typed entities, seed data, access checks, and publish requirements.
- `src/services.ts`: **the backend seam.** Every state change is a pure
  `AppState -> AppState` transition here, plus the `PaymentGateway` interface.
- `src/store.tsx`: binds transitions to persisted local state and exposes
  `apply` and `payments` to screens.
- `src/boundary.tsx`: error boundary for render failures below the app shell.
- `src/ui.tsx`: shared design tokens, controls, and responsive navigation.
- `src/consumer.tsx`, `src/creator.tsx`: complete role-specific flows.
- `src/media.ts`, `src/media.web.ts`: native and web media adapters.
- `src/player.tsx`: Expo Video playback with error state and pause-on-navigation.

### Wiring a backend

Screens never build state inline — they dispatch a transition (`apply(...)`) or
call a service. So the handoff is confined to `src/services.ts`:

1. **Payments.** Replace `localPaymentGateway` with a real provider and move the
   charge server-side. Pass the implementation via `<Provider payments={...}>`;
   the membership screen does not change. Delete the payment sandbox control in
   `src/consumer.tsx` at the same time.
2. **Membership authorization.** `hasAccess` is a presentation check. Real media
   must be gated by the server, with authoritative period dates and renewal
   webhooks rather than dates the client wrote.
3. **Accounts.** `signIn` currently accepts any name and email. Swap it for real
   authentication and keep the session off the device.
4. **The remaining transitions** (channel, workouts, programs, payouts, support)
   become API calls returning the same shapes.

Also needed before release: cloud media upload and transcoding, store billing
where required, real payout onboarding, support delivery, and public channel
data shared across devices.

## Verification

```sh
npm run typecheck
npm test
npm run test:ui
npx expo-doctor
npx expo export --platform ios --platform android --output-dir dist-native
```

`test:ui` runs interaction tests against the production Expo web bundle in JSDOM. It verifies navigation, forms, state updates, purchase failure/retry, completion, cancellation, creator setup/publishing, and member/earnings updates. It does **not** verify browser layout, real media decoding, native file selection, or device behavior. See `VALIDATION.md` for the delivered checks and limitations.

## Asset credits

Illustrative fitness photos from Unsplash:

- https://images.unsplash.com/photo-1518611012118-696072aa579a
- https://images.unsplash.com/photo-1517836357463-d25dfeac3438
- https://images.unsplash.com/photo-1544367567-0f2fcb009e0b
- https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38

Coach identities and offers are fictional demo content. The branded demo video and simple dumbbell app icon were created for this prototype.
