import { Simulation } from './engine';

export function createReport(input: unknown) {
  const sim = new Simulation(input);
  const final = sim.runToEnd();
  return {
    reportVersion: 1,
    scenarioId: sim.scenario.id,
    assumptions: {
      robots: 1,
      units: 'm',
      dispatch: 'FIFO',
      travel: 'constant-speed graph edges; instantaneous turns',
      loading: 'fixed service times',
      traffic: 'single robot; no fleet arbitration',
    },
    completedTasks: final.completedTasks,
    unfinishedTasks: final.tasks.length - final.completedTasks,
    distanceMetres: final.distanceMetres,
    elapsedSeconds: final.time,
    completionTimes: final.tasks.map((t) => t.completedAt),
    final,
  };
}
