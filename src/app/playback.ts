import { Simulation, type Snapshot } from '../sim/engine';
import type { Scenario } from '../sim/schema';

/** Wall time is supplied by the application; simulation time never depends on frame counts. */
export class Playback {
  private engine: Simulation;
  private anchorWall = 0;
  private anchorSimulation = 0;
  running = false;
  speed = 1;
  readonly duration: number;

  constructor(readonly scenario: Scenario) {
    this.engine = new Simulation(scenario);
    const reference = new Simulation(scenario);
    reference.runToEnd();
    this.duration = reference.time;
  }

  snapshot(): Snapshot {
    return this.engine.snapshot();
  }

  update(wallMilliseconds: number): Snapshot {
    if (this.running) {
      const target = Math.min(
        this.duration,
        this.anchorSimulation + ((wallMilliseconds - this.anchorWall) / 1000) * this.speed,
      );
      this.engine.advanceTo(Math.max(this.engine.time, target));
      if (target >= this.duration) this.running = false;
    }
    return this.engine.snapshot();
  }

  play(wallMilliseconds: number): void {
    if (this.snapshot().finished) this.seek(0);
    this.anchorWall = wallMilliseconds;
    this.anchorSimulation = this.engine.time;
    this.running = true;
  }

  pause(wallMilliseconds: number): Snapshot {
    const snapshot = this.update(wallMilliseconds);
    this.running = false;
    return snapshot;
  }

  setSpeed(speed: number, wallMilliseconds: number): void {
    if (!Number.isFinite(speed) || speed <= 0) throw new Error('Playback speed must be positive');
    this.update(wallMilliseconds);
    this.anchorWall = wallMilliseconds;
    this.anchorSimulation = this.engine.time;
    this.speed = speed;
  }

  seek(time: number): Snapshot {
    if (!Number.isFinite(time) || time < 0) throw new Error('Seek time must be nonnegative');
    this.running = false;
    this.engine = new Simulation(this.scenario);
    return this.engine.advanceTo(Math.min(time, this.duration));
  }

  step(seconds: number): Snapshot {
    return this.seek(this.snapshot().time + seconds);
  }
}
