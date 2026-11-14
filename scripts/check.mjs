import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = ['index.js', 'client.js', ...(await readdir(new URL('../lib/', import.meta.url))).filter(name => name.endsWith('.js')).map(name => `lib/${name}`)];
for (const file of files) {
  const check = spawnSync(process.execPath, ['--check', file], { cwd: root, stdio: 'inherit' });
  if (check.status !== 0) process.exit(check.status || 1);
}
console.log(`Syntax checked ${files.length} JavaScript files.`);
