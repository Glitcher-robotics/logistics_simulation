import { describe, expect, it } from 'vitest';
import fixture from '../../scenarios/single-amr.json';
import { Simulation } from './engine';
import { createReport } from './report';

describe('single-AMR transport', () => {
  it('matches the independent distance and delivery-time calculation', () => {
    const report = createReport(fixture);
    expect(report.distanceMetres).toBe(146);
    expect(report.completedTasks).toBe(3);
    expect(report.completionTimes[0]).toBeCloseTo(42, 8);
    expect(report.completionTimes[1]).toBeCloseTo(92 + 1 / 3, 8);
    expect(report.elapsedSeconds).toBeCloseTo(142 + 2 / 3, 8);
    expect(report.final.pallets.every((p) => p.owner === 'dropoff')).toBe(true);
  });

  it('keeps state and events identical across large and small advances', () => {
    const direct = new Simulation(fixture);
    const stepped = new Simulation(fixture);
    for (let t = 0.25; t <= 70; t += 0.25) stepped.advanceTo(t);
    expect(stepped.snapshot()).toEqual(direct.advanceTo(70));
  });

  it('projects the exact position within a moving edge', () => {
    const snapshot = new Simulation(fixture).advanceTo(5);
    expect(snapshot.robot.x).toBe(3);
    expect(snapshot.robot.z).toBe(9);
    expect(snapshot.distanceMetres).toBe(6);
  });

  it('transfers one pallet only after loading, and counts delivery after unloading', () => {
    const sim = new Simulation(fixture);
    const loading = sim.advanceTo(15);
    expect(loading.robot.phase).toBe('loading');
    expect(loading.pallets[0]!.owner).toBe('pickup');
    expect(loading.completedTasks).toBe(0);
    const carrying = sim.advanceTo(20);
    expect(carrying.robot.carrying).toBe('MOVE-001');
    expect(carrying.pallets.filter((p) => p.owner === 'robot')).toHaveLength(1);
    const unloading = sim.advanceTo(40);
    expect(unloading.robot.phase).toBe('unloading');
    expect(unloading.completedTasks).toBe(0);
    expect(sim.advanceTo(42).pallets[0]!.owner).toBe('dropoff');
    expect(sim.snapshot().completedTasks).toBe(1);
  });

  it('uses release time, then input order, for FIFO assignment', () => {
    const input = structuredClone(fixture);
    input.tasks.forEach((t) => (t.releaseAt = 0));
    const result = new Simulation(input).runToEnd();
    expect(result.events.filter((e) => e.type === 'assigned').map((e) => e.taskId)).toEqual(
      input.tasks.map((t) => t.id),
    );
  });

  it('waits for a future task rather than starting it early', () => {
    const input = structuredClone(fixture);
    input.tasks = [{ ...input.tasks[0]!, releaseAt: 10 }];
    const sim = new Simulation(input);
    expect(sim.advanceTo(9).robot.phase).toBe('idle');
    expect(sim.runToEnd().time).toBeCloseTo(52, 8);
  });

  it('does not mutate source scenarios or previously returned snapshots', () => {
    const input = structuredClone(fixture);
    const original = structuredClone(input);
    const sim = new Simulation(input);
    const snapshot = sim.snapshot();
    const saved = structuredClone(snapshot);
    sim.runToEnd();
    expect(input).toEqual(original);
    expect(snapshot).toEqual(saved);
  });

  it('changes physical completion time when speed changes', () => {
    const input = structuredClone(fixture);
    input.robot.speed = 1.5;
    expect(new Simulation(input).runToEnd().time).toBeCloseTo(146 / 1.5 + 21, 8);
  });

  it('supports zero service times without losing tasks', () => {
    const input = structuredClone(fixture);
    input.robot.loadSeconds = 0;
    input.robot.unloadSeconds = 0;
    const result = new Simulation(input).runToEnd();
    expect(result.completedTasks).toBe(3);
    expect(result.time).toBeCloseTo(146 / 1.2, 8);
  });

  it('rejects reverse or non-finite time travel', () => {
    const sim = new Simulation(fixture);
    sim.advanceTo(10);
    expect(() => sim.advanceTo(9)).toThrow(/backwards/);
    expect(() => sim.advanceBy(-2)).toThrow(/backwards/);
    expect(() => sim.advanceTo(NaN)).toThrow(/finite/);
  });
});
