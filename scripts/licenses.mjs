// Writes public/licenses.txt: the license of every package the game ships with, which their
// licenses ask us to pass on. Runs before each build, so it follows the dependencies.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (dir) => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
const seen = new Map();

function visit(name) {
  if (seen.has(name)) return;
  const dir = join('node_modules', name);
  if (!existsSync(dir)) return;
  const pkg = read(dir);
  if (pkg.name.startsWith('@types/')) return; // Type declarations only; nothing of them ships.
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)/i.test(f));
  seen.set(name, { pkg, text: file ? readFileSync(join(dir, file), 'utf8').trim() : null });
  for (const dep of Object.keys(pkg.dependencies ?? {})) visit(dep);
}

for (const dep of Object.keys(read('.').dependencies)) visit(dep);

const blocks = [...seen.values()]
  .sort((a, b) => a.pkg.name.localeCompare(b.pkg.name))
  .map(({ pkg, text }) => {
    const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
    const head = `${pkg.name} ${pkg.version} (${pkg.license})${repo ? `\n${repo}` : ''}`;
    return `${head}\n\n${text ?? `Licensed under the ${pkg.license} license.`}`;
  });

const intro = 'Atom Trap: Neon is built with the open-source software below. Thank you to its authors.';
writeFileSync('public/licenses.txt', [intro, ...blocks].join(`\n\n${'='.repeat(72)}\n\n`) + '\n');
console.log(`licenses.txt: ${blocks.length} packages`);
