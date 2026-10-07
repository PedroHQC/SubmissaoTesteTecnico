import { rm, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Only generated output is trimmed. Original art/audio libraries remain in public/.
const output = fileURLToPath(new URL('../dist/', import.meta.url));
const root = resolve(output);
if (!(await stat(root)).isDirectory()) throw new Error('Build output dist/ is missing.');
for (const entry of ['assets/TestAssets']) {
  const target = resolve(root, entry);
  if (!target.startsWith(root + sep)) throw new Error('Refusing to modify files outside dist/.');
  await rm(target, { recursive: true, force: true });
}
console.log('Production output ready: unused test assets excluded; local demo API worker retained.');
