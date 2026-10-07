# Pirate Battle

A single-player naval shooter built with React, strict TypeScript and PixiJS. Play in a fixed **Arena**, or select **Open Sea** for the scrolling-world extension. Ranking and history use Axios, TanStack Query and a persistent MSW REST simulation.

## Previews



https://github.com/user-attachments/assets/5cf61ae8-4b16-4694-bf84-1916db9891cf



https://github.com/user-attachments/assets/5f6d8384-3819-46cb-9dc6-6a6fe7443f4b



## Setup

Node.js 24.x and npm are required. No environment variables, private services or API credentials are needed.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Asset loading finishes before Play is enabled. A failed required asset exposes **Try again**.

## Controls and mobile

| Action                     | Keyboard                          | Touch                                           |
| -------------------------- | --------------------------------- | ----------------------------------------------- |
| Throttle / reverse         | W / S or up / down                | Drag joystick; directional buttons are optional |
| Turn                       | A / D or left / right             | Joystick heading or left/right buttons          |
| Bow cannon                 | Space                             | Hold bow cannon                                 |
| Port / starboard broadside | Q / E                             | Hold the corresponding cannon                   |
| Pause / resume             | Focus and activate the HUD button | Pause button / Resume                           |
| Open Sea zoom              | Light mouse-wheel scroll          | Default fitted camera                           |

**Landscape is the primary mobile orientation.** Portrait remains usable, and rotating does not restart the match. Menus use scrolling content where needed. Safe-area padding protects notches and home indicators. Touch supports steering and firing simultaneously; cancelled touches cannot leave commands held.

Use **Options > Controls** to switch between joystick and buttons. Use **Options > Audio** for the master volume, combat group, cannons, impacts, explosions, UI, alerts, ocean and sailing. Preferences are saved immediately. Audio starts after a browser-approved user interaction.

## Gameplay settings

**Options > Game** exposes game session time (**60-180 seconds**), enemy spawn time (**0.5-5 seconds**) and mode. Invalid values are clamped to those documented limits. Saving during a paused match affects the next match; each match keeps its own snapshot.

Arena uses two blocking islands arranged in a 1280 x 768 reference layout. Its playable boundaries follow the device's visible viewport, including resizing and the gentle dynamic zoom; water beyond the island layout is playable. Open Sea streams a seeded world and follows the player with a camera. Ranking compares only matches with the same duration, spawn interval and mode. Each enemy destroyed by player fire awards one point; Chaser ramming does not.

Arena keeps the camera centered, with 25% more visible area than its full-field fit and a gentle speed-based zoom of up to 3%. Water fills the surrounding screen, so no black bars are needed. Waves advance every 30 active seconds: carrier and Chaser limits start at one each, rise to two, then cap at three each. Only carriers enter from the spawn director; every Chaser launches from a living carrier. Shooters must point their bow toward the player before firing. The player's fourth ship image is used only after death.

The central balance entry point is [src/config/gameplay.ts](src/config/gameplay.ts). Ship inertia, AI, projectiles, damage, cooldowns, spawn distribution and world settings are typed configurations. Defaults favor a player that can outrun small boats after accelerating, with slower carriers.

Pausing or losing focus suspends gameplay and clears input. Resume is explicit. Leaving combat abandons that match without recording it. Finished matches have a saved last-result screen, available from **Last result** after refresh.

## Network scenarios

Open **Options > Network**. Scenarios include normal success/multiple pages, empty results, slow network, responses out of order, timeout, connection failure, HTTP 400/500, individual ranking/history failures, timeout after insertion and unavailable match submission.

To reproduce an idempotent recovery:

1. Select **POST TIMEOUT THEN RECOVER**, save and finish a match.
2. The result says the upload is pending even though the mock database inserted the record.
3. Select **SUCCESS**, then retry the upload or open Match History.
4. The record appears once and the pending queue clears, including after refresh.

**Reset demo records and network** restores fixtures and normal networking. Pending records are deliberately preserved. **Retry pending uploads** explicitly flushes them. API failures never pause gameplay or prevent starting a new match.

This is a local API simulation. Records persist per browser/domain, not across users or devices. Confirmed records, pending uploads, the last result, gameplay options, audio and control preference have independent storage keys. MSW must remain in the production build.

## Commands

| Command                           | Purpose                                                |
| --------------------------------- | ------------------------------------------------------ |
| npm run dev                       | Development server on port 5173                        |
| npm run build                     | Lint, strict type check and optimized production build |
| npm run preview                   | Serve dist locally                                     |
| npm run lint                      | ESLint and formatting checks                           |
| npm run typecheck                 | TypeScript without emitting files                      |
| npm test                          | Rules, navigation, collisions and input unit tests     |
| npm run test:e2e                  | Chromium desktop, portrait mobile and landscape mobile |
| npm run test:e2e:desktop          | Desktop only                                           |
| npm run test:e2e:mobile           | Both mobile orientations                               |
| npm run test:e2e:update-snapshots | Intentionally update visual baselines                  |
| npm run test:e2e:report           | Open the most recent HTML report                       |
| npm run build:profile             | Optimized instrumented build for measurement           |
| npm run profile                   | Three-minute frame capture and five memory cycles      |

Before the first browser-test run:

```sh
npx playwright install chromium
npm run test:e2e
```

Playwright builds its own optimized test version and serves it on port 4175, avoiding hot-reload changes during a test. Each test starts with isolated storage. A manual clock advances real game rules deterministically. The reference visual baselines were generated on Windows/Chromium; other operating systems may need their own reviewed baselines.

The HTML report is written to `playwright-report/`, and failure screenshots, videos and traces to `test-results/`. Open a trace with `npx playwright show-trace path/to/trace.zip`. Retained delivery evidence is described in [reports/TESTS.md](reports/TESTS.md).

## Delivery

- [ARCHITECTURE.md](ARCHITECTURE.md): simulation, resource ownership, contracts, caching and persistence.
- [reports/PROFILING.md](reports/PROFILING.md): measured performance, hardware and limitations.
- [ASSETS.md](ASSETS.md): asset provenance and dependency licenses.

The postbuild removes only the unused original TestAssets library from `dist/`; it retains the actual game art, audio and MSW worker. Source assets stay in the repository. Normal production builds omit test-control hooks. Existing large-bundle warnings are informational; deferred asset/network loading and mobile fill rate remain optimization opportunities.

Vercel link to play the game: https://submissao-teste-tecnico.vercel.app/
