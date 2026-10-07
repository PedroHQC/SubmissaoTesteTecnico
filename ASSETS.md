# Assets and dependencies

## Game art and sound

The ship, tile, UI and sound files in `public/assets/` were supplied with the Pirate Battle challenge / existing repository. The supplied effect texture `public/assets/UsedAssets/Effects/wake_foam.png` is used for water splashes. No generated bitmap assets were added in this delivery. Explosion quads and the joystick visuals are drawn in code.

No standalone license or attribution file accompanied these supplied files in the checked-out asset tree. Their provenance is the challenge material; this repository does not invent or grant a third-party redistribution license. The challenge owner should supply the original asset license if this project is redistributed beyond the evaluation.

## Software

The lockfile records the exact installed versions. Dependency license files are included in their installed npm packages. Principal dependencies:

| Package           | License    |
| ----------------- | ---------- |
| React / React DOM | MIT        |
| TypeScript        | Apache-2.0 |
| PixiJS            | MIT        |
| TanStack Query    | MIT        |
| Axios             | MIT        |
| MSW               | MIT        |
| Playwright        | Apache-2.0 |
| Vite              | MIT        |
| lil-gui           | MIT        |

The interface uses system fonts; no external font service is required.
