import type { FloorNode, Scenario } from './schema';

export function distance(a: Pick<FloorNode, 'x' | 'z'>, b: Pick<FloorNode, 'x' | 'z'>): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function shortestPath(scenario: Scenario, from: string, to: string): FloorNode[] {
  const nodes = new Map(scenario.nodes.map((n) => [n.id, n]));
  if (!nodes.has(from) || !nodes.has(to))
    throw new Error(`Unknown route endpoint: ${from} → ${to}`);
  if (from === to) return [];
  const remaining = new Set(nodes.keys());
  const cost = new Map<string, number>([[from, 0]]);
  const previous = new Map<string, string>();
  while (remaining.size) {
    let current: string | undefined;
    for (const candidate of remaining) {
      if (
        current === undefined ||
        (cost.get(candidate) ?? Infinity) < (cost.get(current) ?? Infinity)
      )
        current = candidate;
    }
    if (current === undefined || !Number.isFinite(cost.get(current))) break;
    remaining.delete(current);
    if (current === to) break;
    for (const edge of scenario.edges) {
      const neighbor =
        edge.from === current ? edge.to : edge.to === current ? edge.from : undefined;
      if (!neighbor || !remaining.has(neighbor)) continue;
      const tentative = cost.get(current)! + distance(nodes.get(current)!, nodes.get(neighbor)!);
      if (tentative < (cost.get(neighbor) ?? Infinity)) {
        cost.set(neighbor, tentative);
        previous.set(neighbor, current);
      }
    }
  }
  const result: FloorNode[] = [];
  let cursor = to;
  while (cursor !== from) {
    result.unshift(nodes.get(cursor)!);
    const before = previous.get(cursor);
    if (!before) throw new Error(`No route: ${from} → ${to}`);
    cursor = before;
  }
  return result;
}
