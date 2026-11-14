import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = process.env.DSH_JOURNAL_CLI || '/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh';
const env = {
  ...process.env,
  DSH_HOME: `${root}.dev/dsh-home`,
  DSH_AGENTS_HOME: `${root}.dev/agents`,
  ISDOU_DSH_JOURNAL_DATA_DIR: `${root}.dev/reports`,
};
await mkdir(env.DSH_HOME, { recursive: true, mode: 0o700 });
await mkdir(env.DSH_AGENTS_HOME, { recursive: true, mode: 0o700 });

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cli, args, { cwd: root, env, stdio: 'inherit' });
    const stop = signal => child.kill(signal);
    const sigint = () => stop('SIGINT');
    const sigterm = () => stop('SIGTERM');
    process.once('SIGINT', sigint);
    process.once('SIGTERM', sigterm);
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      process.removeListener('SIGINT', sigint);
      process.removeListener('SIGTERM', sigterm);
      if (code === 0 || signal === 'SIGINT' || signal === 'SIGTERM') resolve();
      else reject(new Error(`DSH exited with ${code ?? signal}`));
    });
  });
}

try {
  await run(['plugin', '--profile', 'web', 'add', root]);
  if (!process.argv.includes('--install-only')) {
    console.log('DSH Journal isolated preview: http://127.0.0.1:3082');
    await run(['web', '--host', '127.0.0.1', '--port', '3082', '--no-open']);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
