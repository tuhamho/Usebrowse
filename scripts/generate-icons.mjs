// Copies the prepared Tuhamho Brow icon sizes into WXT's public icon directory.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'src', 'extension', 'assets', 'brand', 'icons');
const outDir = join(root, 'src', 'extension', 'public', 'icon');

mkdirSync(outDir, { recursive: true });
for (const size of [16, 32, 48, 96, 128]) {
  const file = `${size}.png`;
  copyFileSync(join(sourceDir, file), join(outDir, file));
  console.log(`copied ${join(outDir, file)}`);
}
