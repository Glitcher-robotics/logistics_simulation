import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createReport } from '../src/sim/report';

const input: unknown = JSON.parse(await readFile('scenarios/single-amr.json', 'utf8'));
const expected = JSON.parse(await readFile('scenarios/expected/single-amr.json', 'utf8')) as {
  scenarioId: string;
  completedTasks: number;
  unfinishedTasks: number;
  distanceMetres: number;
  elapsedSeconds: number;
  completionTimes: number[];
  tolerance: number;
};
const actual = createReport(input);
for (const key of ['scenarioId', 'completedTasks', 'unfinishedTasks'] as const)
  assert.equal(actual[key], expected[key], key);
for (const key of ['distanceMetres', 'elapsedSeconds'] as const)
  assert(
    Math.abs(actual[key] - expected[key]) < expected.tolerance,
    `${key}: ${actual[key]} != ${expected[key]}`,
  );
assert.equal(actual.completionTimes.length, expected.completionTimes.length);
actual.completionTimes.forEach((t, i) =>
  assert(
    t !== null && Math.abs(t - expected.completionTimes[i]!) < expected.tolerance,
    `Task ${i + 1} completion time`,
  ),
);
console.log('Baseline passed: 146 m; 3 deliveries; final unload at 142.666666667 s.');
