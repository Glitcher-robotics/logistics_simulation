import { z } from 'zod';

const id = z.string().trim().min(1).max(80);
const number = z.number().finite();
const node = z.strictObject({ id, name: z.string().min(1).max(120), x: number, z: number });
const rack = z.strictObject({
  id,
  x: number,
  z: number,
  width: number.positive(),
  depth: number.positive(),
  height: number.positive().max(30),
});

export const scenarioSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id,
    name: z.string().min(1).max(160),
    units: z.literal('m'),
    layout: z.strictObject({
      width: number.positive().max(1000),
      depth: number.positive().max(1000),
      racks: z.array(rack).max(1000),
    }),
    nodes: z.array(node).min(1).max(10000),
    edges: z.array(z.strictObject({ from: id, to: id })).max(30000),
    robot: z.strictObject({
      id,
      startNode: id,
      speed: number.positive().max(10),
      loadSeconds: number.nonnegative().max(3600),
      unloadSeconds: number.nonnegative().max(3600),
      width: number.positive().max(10),
      length: number.positive().max(20),
      height: number.positive().max(10),
    }),
    tasks: z
      .array(
        z.strictObject({
          id,
          releaseAt: number.nonnegative().max(604800),
          pickup: id,
          dropoff: id,
        }),
      )
      .min(1)
      .max(10000),
  })
  .superRefine((s, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    for (const [label, entries] of [
      ['nodes', s.nodes],
      ['tasks', s.tasks],
      ['racks', s.layout.racks],
    ] as const) {
      const seen = new Set<string>();
      for (const entry of entries) {
        if (seen.has(entry.id)) issue(`${label}: duplicate ID "${entry.id}"`);
        seen.add(entry.id);
      }
    }
    const nodes = new Map(s.nodes.map((n) => [n.id, n]));
    const adjacency = new Map(s.nodes.map((n) => [n.id, [] as string[]]));
    const margin = Math.hypot(s.robot.width, s.robot.length) / 2;
    for (const n of s.nodes) {
      if (
        n.x < margin ||
        n.z < margin ||
        n.x > s.layout.width - margin ||
        n.z > s.layout.depth - margin
      )
        issue(`Node "${n.id}" is outside the floor or too close to its boundary`);
    }
    for (const r of s.layout.racks) {
      if (
        r.x - r.width / 2 < 0 ||
        r.z - r.depth / 2 < 0 ||
        r.x + r.width / 2 > s.layout.width ||
        r.z + r.depth / 2 > s.layout.depth
      )
        issue(`Rack "${r.id}" is outside the floor`);
    }
    const edgeIds = new Set<string>();
    for (const e of s.edges) {
      const a = nodes.get(e.from);
      const b = nodes.get(e.to);
      if (!a || !b) {
        issue(`Edge "${e.from} → ${e.to}" references a missing node`);
        continue;
      }
      const key = JSON.stringify([e.from, e.to].sort());
      if (edgeIds.has(key)) issue(`Duplicate edge "${e.from} → ${e.to}"`);
      edgeIds.add(key);
      if (Math.hypot(a.x - b.x, a.z - b.z) < 1e-9) {
        issue(`Edge "${e.from} → ${e.to}" has zero length`);
        continue;
      }
      adjacency.get(e.from)?.push(e.to);
      adjacency.get(e.to)?.push(e.from);
      for (const r of s.layout.racks) {
        if (
          segmentHitsRectangle(
            a,
            b,
            r.x - r.width / 2 - margin,
            r.x + r.width / 2 + margin,
            r.z - r.depth / 2 - margin,
            r.z + r.depth / 2 + margin,
          )
        )
          issue(`Edge "${e.from} → ${e.to}" intersects clearance of rack "${r.id}"`);
      }
    }
    for (const n of s.nodes) {
      for (const r of s.layout.racks) {
        if (
          Math.abs(n.x - r.x) <= r.width / 2 + margin &&
          Math.abs(n.z - r.z) <= r.depth / 2 + margin
        )
          issue(`Node "${n.id}" intersects clearance of rack "${r.id}"`);
      }
    }
    if (!nodes.has(s.robot.startNode)) issue(`Robot start node "${s.robot.startNode}" is missing`);
    const reachable = new Set<string>();
    const todo = [s.robot.startNode];
    while (todo.length) {
      const current = todo.pop()!;
      if (reachable.has(current)) continue;
      reachable.add(current);
      todo.push(...(adjacency.get(current) ?? []).filter((n) => !reachable.has(n)));
    }
    for (const task of s.tasks) {
      for (const target of [task.pickup, task.dropoff]) {
        if (!nodes.has(target)) issue(`Task "${task.id}": node "${target}" is missing`);
        else if (!reachable.has(target))
          issue(`Task "${task.id}": node "${target}" is unreachable`);
      }
      if (task.pickup === task.dropoff)
        issue(`Task "${task.id}" has identical pickup and drop-off`);
    }
  });

/** Conservative rectangle clearance using the AMR's half diagonal, not exact swept-body physics. */
function segmentHitsRectangle(
  a: { x: number; z: number },
  b: { x: number; z: number },
  xmin: number,
  xmax: number,
  zmin: number,
  zmax: number,
): boolean {
  let low = 0;
  let high = 1;
  for (const [start, delta, min, max] of [
    [a.x, b.x - a.x, xmin, xmax],
    [a.z, b.z - a.z, zmin, zmax],
  ] as const) {
    if (Math.abs(delta) < 1e-12) {
      if (start < min || start > max) return false;
    } else {
      const t1 = (min - start) / delta;
      const t2 = (max - start) / delta;
      low = Math.max(low, Math.min(t1, t2));
      high = Math.min(high, Math.max(t1, t2));
      if (low > high) return false;
    }
  }
  return true;
}

export type Scenario = z.infer<typeof scenarioSchema>;
export type FloorNode = Scenario['nodes'][number];
export function parseScenario(input: unknown): Scenario {
  return scenarioSchema.parse(input);
}
