# Performance evidence

Measured on October 7, 2026 with `npm run build:profile` followed by `npm run profile`. This is an optimized Vite build with observation hooks enabled; the simulation and renderer are the production implementations.

This capture predates subsequent Arena camera, forward-only enemy firing and wave changes. No new performance measurement is claimed for those changes.

## Reference environment

- Windows 11 Pro; Intel Core i7-13700HX; approximately 32 GiB RAM.
- NVIDIA GeForce RTX 4070 Laptop GPU, ANGLE Direct3D 11.
- Playwright Chromium 153.0.8010.12, full Chromium headless channel.
- Viewport 1280 x 720, device pixel ratio 1.
- Arena, 180 active seconds, spawn interval 1.5 seconds, seed 42.
- Invulnerability enabled solely to sustain the workload. Forward movement, right turn and all three cannons held throughout. The actual combat, collisions, spawning and rendering remained active.

## Frame timing

| Measurement                     |       Observed |
| ------------------------------- | -------------: |
| Average frame rate              |      60.00 FPS |
| 95th percentile frame interval  |       16.90 ms |
| Maximum frame interval          |       21.30 ms |
| Recorded frames                 |         10,798 |
| Recorded wall time              | 179.96 seconds |
| Peak sampled active enemy ships |              8 |
| Peak sampled player projectiles |             19 |

Recording starts just after the match and input setup, accounting for the fraction below 180 seconds. Entity samples are collected once per second; these peaks need not occur together. Counts cover active enemies and player projectiles, not all effect quads, terrain sprites or enemy projectiles. Raw samples are included in [profiling/results.json](profiling/results.json), and every measured frame interval in [profiling/frames.csv](profiling/frames.csv). The [completion screenshot](profiling/match-complete.png) records the resulting game screen.

The 60 FPS target was met on this reference machine and configuration. This is not a claim about physical mobile devices, maximum enemy populations, DPR 2, or the streamed Open Sea mode.

## Five start/play/exit cycles

After the long match, each cycle played for ten real seconds while firing, paused, returned to the menu, then forced garbage collection through Chromium DevTools Protocol. The same application and shared texture cache stayed mounted, matching ordinary menu navigation.

| Cycle | JS heap bytes after GC | Documents | DOM nodes | Event listeners | Canvases |
| ----- | ---------------------: | --------: | --------: | --------------: | -------: |
| 1     |             12,103,400 |         1 |       119 |             242 |        1 |
| 2     |             12,176,128 |         1 |       119 |             246 |        1 |
| 3     |             12,236,828 |         1 |       119 |             245 |        1 |
| 4     |             12,273,884 |         1 |       119 |             242 |        1 |
| 5     |             12,304,248 |         1 |       119 |             243 |        1 |

All five exit samples have a stopped simulation, zero active enemies and zero player projectiles. Document, node and canvas counts are constant; event listeners fluctuate without a cumulative increase. Heap usage rises by 200,848 bytes (1.66%) across the samples, with diminishing increments. Resource cleanup and listener ownership were reviewed alongside these counts; there was no corresponding accumulation of active game entities or DOM resources. These five samples do not prove the absence of a slow heap leak. A longer soak test with heap-snapshot comparison would be needed to attribute the remaining retained allocations conclusively.

The measurement reports JavaScript heap after forced GC, not total browser process memory, WebGL texture memory or audio buffers. Shared textures, audio and object pools intentionally remain available between matches. A full application unmount uses a separate disposal path, covered by repeated loading/navigation checks rather than this memory sequence.

## Reproduction

```sh
npm ci
npx playwright install chromium
npm run build:profile
npm run profile
```

Keep the machine otherwise idle. The script uses port 4177 and writes fresh raw evidence to `reports/profiling/`. It takes approximately four minutes. Hardware collection uses PowerShell on Windows; other operating systems record only the platform name and require manually adding hardware details. Browser/GPU scheduling may change the results.
