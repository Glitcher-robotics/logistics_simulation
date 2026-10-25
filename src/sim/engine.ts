import { EventQueue } from './queue';
import { distance, shortestPath } from './routing';
import { parseScenario, type FloorNode, type Scenario } from './schema';

export type RobotPhase = 'idle' | 'to_pickup' | 'loading' | 'to_dropoff' | 'unloading';
export type TaskStatus = 'scheduled' | 'queued' | 'active' | 'completed';
export type EventType = 'released' | 'assigned' | 'loading' | 'loaded' | 'unloading' | 'delivered';
export interface SimulationEvent {
  time: number;
  type: EventType;
  taskId: string;
}
export interface TaskState {
  id: string;
  status: TaskStatus;
  assignedAt: number | null;
  completedAt: number | null;
}
export interface Snapshot {
  time: number;
  finished: boolean;
  robot: {
    id: string;
    phase: RobotPhase;
    x: number;
    z: number;
    heading: number;
    taskId: string | null;
    carrying: string | null;
    remainingRoute: { x: number; z: number }[];
  };
  tasks: TaskState[];
  pallets: { taskId: string; owner: 'pickup' | 'robot' | 'dropoff'; nodeId: string | null }[];
  completedTasks: number;
  queueLength: number;
  distanceMetres: number;
  events: SimulationEvent[];
}

interface Motion {
  from: FloorNode;
  to: FloorNode;
  startedAt: number;
  endsAt: number;
}
const rounded = (n: number) => Math.round(n * 1e9) / 1e9;

export class Simulation {
  readonly scenario: Scenario;
  private queue = new EventQueue();
  private now = 0;
  private nodeId: string;
  private phase: RobotPhase = 'idle';
  private heading = 0;
  private activeTask: number | null = null;
  private carrying: string | null = null;
  private pending: number[] = [];
  private states: TaskState[];
  private events: SimulationEvent[] = [];
  private motion: Motion | null = null;
  private route: FloorNode[] = [];
  private travelled = 0;

  constructor(input: unknown) {
    this.scenario = parseScenario(input);
    this.nodeId = this.scenario.robot.startNode;
    this.states = this.scenario.tasks.map((task) => ({
      id: task.id,
      status: 'scheduled',
      assignedAt: null,
      completedAt: null,
    }));
    this.scenario.tasks.forEach((task, index) => {
      this.queue.add(task.releaseAt, () => {
        this.states[index]!.status = 'queued';
        this.pending.push(index);
        this.emit('released', index);
        this.assign();
      });
    });
    this.advanceTo(0);
  }

  get time(): number {
    return this.now;
  }

  advanceBy(seconds: number): Snapshot {
    return this.advanceTo(this.now + seconds);
  }

  advanceTo(target: number): Snapshot {
    if (!Number.isFinite(target) || target < this.now)
      throw new Error('Simulation time must be finite and cannot move backwards');
    while (this.queue.nextTime !== undefined && this.queue.nextTime <= target) {
      const event = this.queue.take();
      this.now = event.at;
      event.run();
    }
    this.now = target;
    return this.snapshot();
  }

  runToEnd(): Snapshot {
    let budget = 1_000_000;
    while (this.queue.nextTime !== undefined) {
      if (--budget < 0) throw new Error('Simulation event budget exceeded');
      this.advanceTo(this.queue.nextTime);
    }
    return this.snapshot();
  }

  snapshot(): Snapshot {
    const node = this.getNode(this.nodeId);
    const ratio = this.motion
      ? Math.max(
          0,
          Math.min(
            1,
            (this.now - this.motion.startedAt) / (this.motion.endsAt - this.motion.startedAt),
          ),
        )
      : 0;
    const x = this.motion
      ? this.motion.from.x + (this.motion.to.x - this.motion.from.x) * ratio
      : node.x;
    const z = this.motion
      ? this.motion.from.z + (this.motion.to.z - this.motion.from.z) * ratio
      : node.z;
    const task = this.activeTask === null ? null : this.scenario.tasks[this.activeTask]!;
    const completedTasks = this.states.filter((s) => s.status === 'completed').length;
    return {
      time: rounded(this.now),
      finished: completedTasks === this.states.length,
      robot: {
        id: this.scenario.robot.id,
        phase: this.phase,
        x: rounded(x),
        z: rounded(z),
        heading: this.heading,
        taskId: task?.id ?? null,
        carrying: this.carrying,
        remainingRoute: this.route.map((n) => ({ x: n.x, z: n.z })),
      },
      tasks: this.states.map((s) => ({
        ...s,
        assignedAt: s.assignedAt === null ? null : rounded(s.assignedAt),
        completedAt: s.completedAt === null ? null : rounded(s.completedAt),
      })),
      pallets: this.scenario.tasks.map((t, i) => ({
        taskId: t.id,
        owner:
          this.states[i]!.status === 'completed'
            ? 'dropoff'
            : this.carrying === t.id
              ? 'robot'
              : 'pickup',
        nodeId:
          this.states[i]!.status === 'completed'
            ? t.dropoff
            : this.carrying === t.id
              ? null
              : t.pickup,
      })),
      completedTasks,
      queueLength: this.pending.length,
      distanceMetres: rounded(
        this.travelled + (this.motion ? distance(this.motion.from, this.motion.to) * ratio : 0),
      ),
      events: this.events.map((e) => ({ ...e })),
    };
  }

  private getNode(id: string): FloorNode {
    const node = this.scenario.nodes.find((n) => n.id === id);
    if (!node) throw new Error(`Missing node: ${id}`);
    return node;
  }

  private emit(type: EventType, index: number): void {
    this.events.push({ time: rounded(this.now), type, taskId: this.scenario.tasks[index]!.id });
  }

  private assign(): void {
    if (this.activeTask !== null || !this.pending.length) return;
    const index = this.pending.shift()!;
    const task = this.scenario.tasks[index]!;
    this.activeTask = index;
    this.states[index]!.status = 'active';
    this.states[index]!.assignedAt = this.now;
    this.emit('assigned', index);
    this.phase = 'to_pickup';
    this.travel(task.pickup, () => {
      this.phase = 'loading';
      this.emit('loading', index);
      this.queue.add(this.now + this.scenario.robot.loadSeconds, () => {
        this.carrying = task.id;
        this.emit('loaded', index);
        this.phase = 'to_dropoff';
        this.travel(task.dropoff, () => {
          this.phase = 'unloading';
          this.emit('unloading', index);
          this.queue.add(this.now + this.scenario.robot.unloadSeconds, () => {
            this.carrying = null;
            this.states[index]!.status = 'completed';
            this.states[index]!.completedAt = this.now;
            this.emit('delivered', index);
            this.activeTask = null;
            this.phase = 'idle';
            this.assign();
          });
        });
      });
    });
  }

  private travel(to: string, done: () => void): void {
    this.route = shortestPath(this.scenario, this.nodeId, to);
    const next = () => {
      const destination = this.route[0];
      if (!destination) {
        this.motion = null;
        done();
        return;
      }
      const origin = this.getNode(this.nodeId);
      const length = distance(origin, destination);
      this.heading = Math.atan2(destination.x - origin.x, destination.z - origin.z);
      this.motion = {
        from: origin,
        to: destination,
        startedAt: this.now,
        endsAt: this.now + length / this.scenario.robot.speed,
      };
      this.queue.add(this.motion.endsAt, () => {
        this.travelled += length;
        this.nodeId = destination.id;
        this.motion = null;
        this.route.shift();
        next();
      });
    };
    next();
  }
}
