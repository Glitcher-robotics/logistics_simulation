import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createReport } from '../src/sim/report';
import { parseScenario } from '../src/sim/schema';

const { values } = parseArgs({
  options: {
    scenario: { type: 'string', default: 'scenarios/single-amr.json' },
    out: { type: 'string', default: 'artifacts/single-amr-report.json' },
  },
});
const scenario = parseScenario(JSON.parse(await readFile(resolve(values.scenario!), 'utf8')));
const report = {
  ...createReport(scenario),
  scenarioSha256: createHash('sha256').update(JSON.stringify(scenario)).digest('hex'),
};
const output = resolve(values.out!);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(
  `${report.scenarioId}: ${report.completedTasks} completed, ${report.distanceMetres} m, ${report.elapsedSeconds} s`,
);
console.log(`Report: ${output}`);
