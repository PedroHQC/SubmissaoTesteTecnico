# Architecture

## React and PixiJS

React owns menus, configuration forms, the semantic HUD, dialogs and touch controls. `GameContainer` creates one `GameApp` and subscribes to the typed `GameBridge`. PixiJS owns the world, ships, projectiles, water, wakes, health bars and particles. Continuous positions and velocities never enter React state.

`WorldSandboxScene` is the shared gameplay scene for both modes; its historical name does not mean the UI is disabled. `GameScene` is retained as the older scene and asset-contract source, but is not used by `GameApp`. `WORLD_SANDBOX_MODE` is false. The debug GUI is opt-in through `?debug` in development.

The bridge publishes score and life only when they change, and the displayed timer only when its rounded second changes. Touch events travel through the same bridge. Keyboard and touch inputs are kept separately so releasing a touch cannot cancel a physical key.

## Simulation and input

`SceneManager` accumulates elapsed milliseconds and runs fixed 1/60-second steps. Existing handling values use pixels per 60 Hz tick. Catch-up is capped at 100 ms to avoid a long stall generating an unbounded simulation burst. At sustained very low frame rates, game time may therefore run slower than wall time; profiling measures this limitation.

`ShipController` integrates forward thrust, reverse, drag, lateral grip and angular acceleration. Player and enemy ships share this model. The virtual joystick selects an absolute screen-space heading and proportional throttle, with a dead zone. It does not teleport or directly rotate the ship. Pointer capture, cancellation, focus loss and unmount all release held touch input. Each cannon can be held while another pointer steers.

Manual pause, window blur and document hiding clear input and stop gameplay. Resume requires a click/tap. While paused, the water can animate, but movement, cooldowns, damage, spawns and the match timer do not advance. Abandon resets combat without submitting a result. Restart creates a new match ID and configuration snapshot.

## Arena and Open Sea

Arena is the default mode: two deterministic islands occupy a 1280 × 768 reference layout. Its camera center stays at the layout center, with 25% more visible area than the full-layout fit. A smoothed speed-dependent zoom varies by at most 3%. Playable boundaries match the visible viewport and update with device resizing, orientation and zoom. Water beyond the reference layout is playable; island geometry stays unchanged. Ship limits use their rotated hull extents to keep them visible without an extra invisible margin, and projectiles leave play at the viewport edges. Spawn attempts require water, hull clearance, separation and at least 260 world units from the player.

Open Sea is the optional extension requested during development. `ChunkedWorld` streams seeded tile chunks; the camera follows with look-ahead and light wheel zoom. Old chunks and distant enemies are recycled. In this mode, the viewport is a camera window, not a movement boundary. Rankings include the mode in their comparison key.

Both modes share combat, ship handling, scoring, UI and persistence. Arena keeps a centered camera with movement bounded by the device viewport; Open Sea uses an unrestricted scrolling world.

Shooters spawn entirely beyond the viewport in both modes, with hull clearance and the configured margin and depth. Arena arrivals navigate inward before normal combat begins; boundary clamping starts only after the full hull has entered, preventing a visible spawn or teleport. Incoming Arena ships are not recycled by the Open Sea distance rule. Screen-edge arrows indicate living enemies outside the camera.

## Navigation, collision and combat

Circle-versus-tile collision pushes ships out of solid land. Coast contact removes inward velocity and creates a short rebound. Enemy shoreline checks account for the visible hull, rather than only the smaller combat hit radius. A shared breadth-first flow field routes enemies around islands. Candidate corridor sweeps, braking and a short committed avoidance heading prevent steering oscillation along the coast. Navigation is invalidated when streamed terrain changes.

Front fire emits one projectile. Each broadside emits three parallel projectiles along the hull. Independent cooldowns live in `ShipCannons`. Projectiles have direction, speed, radius and range; the fixed simulation step bounds their travel distance between collision checks. A hit releases the projectile immediately, preventing repeated damage. Destroying an enemy through player fire emits one score event. A Chaser's contact explosion does not score. Sinking Shooters are excluded from targeting and ship separation.

Small boats are launched only through a clear exit corridor outside the carrier's visible hull. Enemy iteration uses a snapshot so a newly allocated pool slot cannot be simulated twice on its launch frame.

The director introduces only Shooters. Every 30 active seconds a new wave increases the concurrent carrier and Chaser limits from one each to two, then three. `CombatConfig` owns wave duration, initial counts and hard caps. Chasers can only launch from active, living Shooters and share a global cap across all carriers. The wave clock pauses with combat and resets on restart. The HUD receives a wave event only when its number changes.

Shooters steer toward their interception aim before firing; both the player's current direction and the predicted aim must fall within an eight-degree cone from the bow. Projectiles leave the bow along the hull heading with limited spread. Player textures contain three living damage stages plus a wreck, which is selected only at zero health.

Balance settings are exposed through `src/config/gameplay.ts`, which collects the typed combat, AI, movement, handling, world and options configurations. Damage and health values are centralized there. The options snapshot includes duration, spawn interval and mode. Local input/audio preferences do not affect ranking comparison.

## Assets and resource ownership

`loadGameAssets` loads shared PixiJS textures before enabling Play. React displays a loading state and a retry action after a failure. The AudioManager decodes reusable buffers and routes them through independently adjustable gain channels. Audio unlock follows the browser's first-interaction policy.

Scene teardown removes bridge and DOM listeners, ticker subscriptions, player timers, chunk containers and effect pools. Shared textures remain in PixiJS's asset cache between scenes. Initialization checks destruction after asynchronous work and `SceneManager` refuses to attach a scene after disposal, including React Strict Mode remounts. Renderer density is capped at 2 to limit mobile fill rate.

Explosion sparks and smoke use pooled colored quads. Water impacts also use the supplied `wake_foam.png`, expanding 40% and fading over 0.85 seconds. Health indicators are PixiJS graphics above each ship, kept upright as the hull rotates.

Every enemy uses the player's `WakeEffect`, scaled to its hull and speed. Enemy wakes live in a separate water-space layer below islands and ships, reuse pooled enemy slots, fade after destruction, and clear on abandon/restart. Spawn generations prevent connecting an old trail to a reused ship. Menu buttons use nine-slice borders to preserve artwork corners across different widths. A noninteractive, temporary banner announces each wave.

All menu/dialog frames use `GamePanel`: a nine-slice border with fixed safe margins around a separate scrollable interior. Options and record panels reserve rows for navigation and footer actions, and scroll their content inside the frame. Extremely short viewports fall back to scrolling the full interior. Narrow layouts use shrinkable grid tracks, bounded form controls and wrapped tabs instead of allowing content across the decorative frame.

## REST demo and persistence

Axios calls `/api/v1/ranking`, `/api/v1/history` and `/api/v1/matches`. MSW intercepts these requests in development, automated browser tests and production. `src/types/LogContracts.ts` defines match records, paginated responses and query parameters. The MSW worker is deliberately retained in the published build.

TanStack Query owns request state, cache, retries, mutation status and invalidation. Query keys contain the page, player and relevant configuration. Abort signals cancel superseded HTTP reads. Ranking sorts by score, survived duration, date and finally match ID. It compares duration, spawn interval and mode; fixtures without a mode are treated as Arena records.

Before sending a completed match, the mutation stores it in the local pending queue. The mock database inserts by unique match ID and returns the existing record on a retry. A timeout after server-side insertion can therefore be retried without duplicating the result. Opening the log flushes pending uploads and invalidates both queries. A failed upload does not prevent another match. The result dialog exposes pending/saving/saved status and manual retry.

Preferences, confirmed mock records, pending uploads and the last completed result use separate localStorage keys. Older local records are migrated when the MSW database is first read. Abandoned matches are never registered. Browser/domain storage boundaries apply; this is not an authenticated, shared multiplayer service.

## Test and profiling instrumentation

Only builds with mode `test` or `profile` expose `window.__PIXI_TEST_HOOKS__`. Normal production builds do not expose it. Browser tests can inspect state, freeze/advance the real simulation, set lifecycle fixtures and arrange a combat encounter. Combat assertions fire actual keyboard/touch controls and use real projectiles, damage and collisions.

Playwright tests use isolated browser contexts and initialize storage only once per context, preserving data across the refresh being tested. Seeded randomness and a manual simulation clock make tests reproducible. Visual tests show the real menu/result UI with only the canvas hidden; they do not cover the whole viewport with a mask. The arena baseline includes PixiJS rendering.

The profiling build is optimized and differs only by its measurement hooks. Its reference workload enables invulnerability to sustain three minutes of combat, then measures five start/play/exit cycles with forced garbage collection. See `reports/PROFILING.md` for measured hardware, frame timing and memory limitations.
