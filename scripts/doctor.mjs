import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [major, minor] = process.versions.node.split('.').map(Number);
const problems = [];
if (major < 22 || (major === 22 && minor < 12))
  problems.push('Node.js 22.12+ is required (24 LTS recommended).');
const required = [
  'pnpm-lock.yaml',
  'AGENTS.md',
  'docs/PLAN.md',
  'src/sim/engine.ts',
  'scenarios/single-amr.json',
];
for (const filename of required)
  if (!existsSync(resolve(filename))) problems.push(`Missing file: ${filename}`);
for (const dependency of ['react', 'three', 'vite', 'vitest', '@playwright/test']) {
  if (!existsSync(resolve('node_modules', dependency, 'package.json')))
    problems.push(`Missing dependency ${dependency}; run pnpm install --frozen-lockfile.`);
}
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (process.env.npm_execpath?.includes('pnpm') && process.env.npm_config_user_agent) {
  const actual = process.env.npm_config_user_agent.split(' ')[0].replace('/', '@');
  if (actual !== pkg.packageManager)
    problems.push(`Use ${pkg.packageManager}; current runner is ${actual}.`);
}
if (problems.length) {
  console.error(problems.map((p) => `FAIL ${p}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `OK Node ${process.versions.node}; ${pkg.packageManager}; installed dependencies and harness files.`,
  );
  console.log('Browser prerequisite for E2E: pnpm exec playwright install chromium.');
}
