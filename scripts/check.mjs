import { spawnSync } from 'node:child_process';

const runner = process.env.npm_execpath;
if (!runner) throw new Error('Run this harness with pnpm check.');
for (const name of [
  'doctor',
  'lint',
  'format:check',
  'typecheck',
  'test',
  'build',
  'scenario:check',
]) {
  console.log(`\nChecking ${name}`);
  const result = spawnSync(process.execPath, [runner, 'run', name], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('\nAll non-browser checks passed. Run pnpm test:e2e for the actual 3D workflow.');
