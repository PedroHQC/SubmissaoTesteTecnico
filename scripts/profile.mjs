import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

// Run after npm run build:profile. No private services or credentials are required.
const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--outDir',
    '.profile-build',
    '--host',
    '127.0.0.1',
    '--port',
    '4177',
    '--strictPort',
  ],
  { windowsHide: true, stdio: 'ignore' }
);
let browser;
try {
  for (let retry = 0; retry < 100; retry++) {
    try {
      if ((await fetch('http://127.0.0.1:4177')).ok) break;
    } catch {
      /* Wait for preview. */
    }
    await delay(200);
  }
  browser = await chromium.launch({ channel: 'chromium' });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      'PIXI_GAME_SETTINGS_V1',
      JSON.stringify({ sessionTime: 180, enemySpawnInterval: 1.5, mode: 'arena' })
    );
    localStorage.setItem('pb_active_network_scenario_v1', 'SUCCESS');
    let seed = 42;
    Math.random = () => {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  });
  await page.goto('http://127.0.0.1:4177');
  await page.getByRole('button', { name: 'PLAY', exact: true }).waitFor();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const renderer = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'Not exposed';
  });
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.evaluate(() => window.__PIXI_TEST_HOOKS__.setInvulnerable(true));
  for (const key of ['KeyW', 'KeyD', 'Space', 'KeyQ', 'KeyE']) await page.keyboard.down(key);
  console.log('Profiling a 180-second match, seed 42, invulnerable stress workload.');
  const recording = page.evaluate(
    () =>
      new Promise((resolve) => {
        const frames = [];
        const entities = [];
        let previous = performance.now();
        let lastSample = previous;
        const started = previous;
        const frame = (now) => {
          frames.push(now - previous);
          previous = now;
          const state = window.__PIXI_TEST_HOOKS__.getState();
          if (now - lastSample >= 1000) {
            entities.push({
              second: (now - started) / 1000,
              enemies: state.enemies,
              playerShots: state.shots,
            });
            lastSample = now;
          }
          if (!state.running) resolve({ frames, entities, elapsed: (now - started) / 1000 });
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      })
  );
  const progress = setInterval(
    () => console.log('Profiling is still recording real frames...'),
    30000
  );
  const match = await recording;
  clearInterval(progress);
  for (const key of ['KeyW', 'KeyD', 'Space', 'KeyQ', 'KeyE']) await page.keyboard.up(key);
  const sorted = [...match.frames].sort((a, b) => a - b);
  const metrics = {
    fps: match.frames.length / match.elapsed,
    p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
    maxFrameMs: sorted.at(-1),
    frames: sorted.length,
    elapsedSeconds: match.elapsed,
  };
  await mkdir('reports/profiling', { recursive: true });
  await page.screenshot({ path: 'reports/profiling/match-complete.png' });
  const cycles = [];
  for (let cycle = 1; cycle <= 5; cycle++) {
    await page.getByRole('button', { name: 'MAIN MENU', exact: true }).click();
    await page.getByRole('button', { name: 'PLAY', exact: true }).click();
    await page.evaluate(() => window.__PIXI_TEST_HOOKS__.setInvulnerable(true));
    await page.keyboard.down('Space');
    await delay(10000);
    await page.keyboard.up('Space');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'MAIN MENU', exact: true }).click();
    await delay(300);
    await cdp.send('HeapProfiler.collectGarbage');
    const data = await cdp.send('Performance.getMetrics');
    const values = Object.fromEntries(data.metrics.map(({ name, value }) => [name, value]));
    cycles.push({
      cycle,
      heapBytes: values.JSHeapUsedSize,
      documents: values.Documents,
      nodes: values.Nodes,
      listeners: values.JSEventListeners,
      canvasCount: await page.locator('canvas').count(),
      state: await page.evaluate(() => window.__PIXI_TEST_HOOKS__.getState()),
    });
    console.log(
      `Memory cycle ${cycle}: ${Math.round(values.JSHeapUsedSize / 1024 / 1024)} MiB heap.`
    );
    if (cycle < 5) await page.getByRole('button', { name: 'Last result', exact: true }).click();
  }
  const hardware =
    process.platform === 'win32'
      ? execFileSync(
          'powershell',
          [
            '-NoProfile',
            '-Command',
            '[pscustomobject]@{CPU=(Get-CimInstance Win32_Processor).Name; GPU=(Get-CimInstance Win32_VideoController).Name; RAMKiB=(Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize; OS=(Get-CimInstance Win32_OperatingSystem).Caption} | ConvertTo-Json',
          ],
          { encoding: 'utf8' }
        )
      : process.platform;
  const result = {
    recordedAt: new Date().toISOString(),
    browser: await browser.version(),
    hardware,
    renderer,
    viewport: '1280x720, DPR 1',
    settings: {
      sessionTime: 180,
      enemySpawnInterval: 1.5,
      mode: 'arena',
      seed: 42,
      invulnerable: true,
    },
    metrics,
    entities: match.entities,
    memoryCycles: cycles,
  };
  await writeFile('reports/profiling/results.json', JSON.stringify(result, null, 2));
  await writeFile(
    'reports/profiling/frames.csv',
    'frame,delta_ms\n' +
      match.frames.map((delta, index) => `${index},${delta.toFixed(3)}`).join('\n')
  );
  console.log(JSON.stringify(metrics));
} finally {
  await browser?.close();
  server.kill();
}
