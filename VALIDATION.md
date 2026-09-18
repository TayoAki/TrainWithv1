# TrainWith frontend validation

## Passed

- TypeScript strict type check.
- Expo Doctor: 21/21 project checks.
- Production Expo web export.
- iOS and Android JavaScript/Hermes exports (compilation, not installed native builds).
- Three domain tests: creator-specific membership access/expiration, handle availability/reserved names, and channel publication requirements.
- Twelve JSDOM interaction groups against the production Expo web bundle:
  1. Application mount and discovery.
  2. Search, channel navigation, program detail and saving.
  3. Free workout completion and undo.
  4. Payment failure/retry, membership activation, unlocking and completion.
  5. Canceling and resuming renewal.
  6. Creator onboarding, duplicate-handle validation and disabled launch action.
  7. Creating and publishing free/member workouts.
  8. Building and publishing an ordered program.
  9. Pricing, demo payout setup and publishing the channel.
  10. Joining that channel updates creator members and earnings.
  11. Support requests remain local.
  12. Workflow results are written to device storage.
- Run script shell syntax and help.
- Bundled photo assets and a valid 30-second H.264 demo video.

Machine-readable interaction results: `tests/latest-result.json`.

## Not verified in this environment

The cloud browser could not open the local server, and the Expo preview tunnel failed to connect. Visual layout, responsive rendering in a real browser, native device interaction, actual media playback, clipboard permissions and native/web file-picker dialogs still need a device/browser pass. JSDOM verifies DOM interactions and state changes; it does not replace visual or device testing. Media methods are stubbed in the interaction test.

No App Store/Play Store build, EAS deployment, backend service, real account authentication, purchase, payout, domain connection or external publication was performed.

## Suggested device acceptance pass

Open with Expo Go and check the core member journey, a real local MP4 selection, playback/pause/fullscreen, keyboard behavior in forms, safe-area layout, app restart persistence, sharing/copy, and the creator publishing journey. On web, check 390px and desktop widths and reload a direct channel route.
