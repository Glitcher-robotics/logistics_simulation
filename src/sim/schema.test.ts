import { describe, expect, it } from 'vitest';
import fixture from '../../scenarios/single-amr.json';
import { parseScenario } from './schema';
import { distance, shortestPath } from './routing';

describe('scenario boundary and routing', () => {
  it('loads the synthetic scenario and finds the 26 m loaded route', () => {
    const s = parseScenario(fixture);
    const path = shortestPath(s, 'pickup', 'dropoff');
    let previous = s.nodes.find((n) => n.id === 'pickup')!;
    let length = 0;
    for (const node of path) {
      length += distance(previous, node);
      previous = node;
    }
    expect(length).toBe(26);
    expect(shortestPath(s, 'pickup', 'pickup')).toEqual([]);
  });
  it('rejects duplicate identifiers', () => {
    const input = structuredClone(fixture);
    input.nodes.push({ ...input.nodes[0]! });
    expect(() => parseScenario(input)).toThrow(/duplicate ID/);
  });
  it('rejects missing and disconnected task endpoints', () => {
    const missing = structuredClone(fixture);
    missing.tasks[0]!.dropoff = 'does-not-exist';
    expect(() => parseScenario(missing)).toThrow(/missing/);
    const disconnected = structuredClone(fixture);
    disconnected.edges.splice(1, 1);
    expect(() => parseScenario(disconnected)).toThrow(/unreachable/);
  });
  it('rejects zero-length edges and duplicate undirected edges', () => {
    const zero = structuredClone(fixture);
    zero.edges.push({ from: 'home', to: 'home' });
    expect(() => parseScenario(zero)).toThrow(/zero length/);
    const duplicate = structuredClone(fixture);
    duplicate.edges.push({ from: 'west', to: 'home' });
    expect(() => parseScenario(duplicate)).toThrow(/Duplicate edge/);
  });
  it('rejects a route crossing rack clearance', () => {
    const input = structuredClone(fixture);
    input.layout.racks[0]!.x = 15;
    input.layout.racks[0]!.z = 12;
    expect(() => parseScenario(input)).toThrow(/clearance/);
  });
  it('rejects off-floor nodes and racks', () => {
    const input = structuredClone(fixture);
    input.nodes[0]!.x = -1;
    expect(() => parseScenario(input)).toThrow(/boundary/);
    input.nodes[0]!.x = 3;
    input.layout.racks[0]!.x = 0;
    expect(() => parseScenario(input)).toThrow(/outside the floor/);
  });
  it('rejects invalid speed, unknown properties, and ambiguous units', () => {
    expect(() => parseScenario({ ...fixture, units: 'mm' })).toThrow();
    expect(() => parseScenario({ ...fixture, fleet: 6 })).toThrow();
    expect(() => parseScenario({ ...fixture, robot: { ...fixture.robot, speed: 0 } })).toThrow();
    expect(() =>
      parseScenario({ ...fixture, robot: { ...fixture.robot, speed: Infinity } }),
    ).toThrow();
  });
});
