# Test evidence

Reference environment: Windows 11 Pro, Node.js 24.13.1, Playwright Chromium 153.0.8010.12. Browser tests run against an optimized test build on port 4175. The test suite uses three isolated projects: desktop 1280 x 720, Pixel 5 portrait and Pixel 5 landscape 851 x 393.

Final run on October 7, 2026: **62 passed, 1 intentionally skipped, 0 failed**, in 3.2 minutes. The 14 unit tests also passed. The retained HTML report corresponds to this completed run, without snapshot updates or retries.

After that full run, Arena received a fixed wider camera, the player wreck was reserved for death, Shooters gained a forward firing cone, and carrier-only Chaser waves were added. TypeScript, lint, all 17 rule tests and 21 targeted combat/visual browser cases passed. Arena baselines were updated and portrait/landscape images reviewed. The retained full HTML report predates these changes; the targeted report is in `reports/gameplay-update/`.

## Checks and scope

The subsequent enemy-wake, button-proportion and wave-announcement edits were made without running tests, as requested. Existing visual baselines and reports predate those UI changes.

- `npm run build`: ESLint, strict TypeScript and optimized production build passed. Vite reports the existing main-chunk size warning (approximately 1.05 MB before gzip); this is not a build failure.
- `npm test`: 14 rule tests passed. These cover launch clearance and the carrier jump regression, speed relationships, collision rebound, hull sweeps, shared navigation, concave-island recovery, bounded camera shake, analog input, dead enemies and one-time scoring.
- `npm run test:e2e`: 21 scenarios across three Chromium projects. The desktop project intentionally skips the CDP multi-touch test; that scenario runs in both touch-enabled mobile projects.
- A separate check of the ordinary production build confirmed asset loading, ranking/history through the shipped MSW worker, gameplay, pause, abandonment and refresh. It found no browser console errors or unhandled page errors and verified that test-control hooks are absent. Raw outcome: [production-smoke.json](production-smoke.json).

## Browser coverage

| Area                  | Automated coverage                                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Options and assets    | Value limits, saving/refresh, mode/control preferences, focus trap, actual required-image failure and retry                                                                                                                                            |
| Navigation and combat | Forward movement, rotation, arena bounds, front and both broadsides, parallel shots, cooldown, projectile damage, one-time score, both enemy types and Shooter attacks                                                                                 |
| Lifecycle             | Manual pause, blur, stopped simulation, explicit resume, real timer expiry, death, clean restart, last-result refresh and abandonment without registration                                                                                             |
| Network               | Ranking and history pagination, loading, empty/error states, real Axios timeout after insertion, recovery after refresh without duplication, delayed response/tab switch, both tabs refreshing, unavailable registration and a new match while pending |
| Mobile                | Portrait/landscape resizing, narrow layouts, simultaneous joystick/fire pointers, cancellation, directional buttons and release outside the button                                                                                                     |
| Extension             | Open Sea camera follow and gentle wheel zoom                                                                                                                                                                                                           |
| Visual                | Real menu, stable PixiJS arena/HUD and result screen, with reviewed baselines for all three projects                                                                                                                                                   |

Unit tests exercise obstacle routing and collision details using real ship physics and tile maps. Browser combat tests trigger real keyboard/touch input and projectiles; lifecycle/network fixtures may set health or complete a match directly to isolate those flows. Browser tests use seeded randomness, controlled network latency and a clock that advances the actual fixed-step simulation. Tests do not substitute alternate combat rules.

Visual menu/result tests hide only the animated canvas behind the React UI. Arena screenshots include the actual PixiJS scene. Baselines are versioned in `e2e/05_visual_regression.spec.ts-snapshots/`. Different OS/font/GPU combinations may need separate reviewed baselines.

## Reports and traces

Open the retained delivery HTML report:

```sh
npx playwright show-report reports/playwright
```

New runs write to `playwright-report/`. Failures retain their screenshots, video and trace in `test-results/`.

A resolved test-harness failure is retained at [failures/mobile-wheel-outside-viewport.zip](failures/mobile-wheel-outside-viewport.zip): the wheel test originally moved the pointer to desktop coordinates outside the portrait viewport. The test now centers the pointer using the actual viewport before dispatching the wheel event. It is historical evidence, not an unresolved game failure.

```sh
npx playwright show-trace reports/failures/mobile-wheel-outside-viewport.zip
```

## Limits

Mobile results use Chromium emulation on desktop hardware. Physical Android/iOS devices and Safari were not measured. Automated accessibility checks here cover semantic labels, visible focus, dialog focus containment and keyboard input; they are not a full screen-reader audit. Failure scenarios are simulated locally by MSW, not a real remote server. Performance evidence and memory limitations are documented separately in [PROFILING.md](PROFILING.md).

No deployment was performed, as requested. Follow [DEPLOY.md](../DEPLOY.md) for publication and a final check of the public URL.
