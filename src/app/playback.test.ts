import { describe, expect, it } from 'vitest';
import fixture from '../../scenarios/single-amr.json';
import { parseScenario } from '../sim/schema';
import { Playback } from './playback';

describe('playback clock', () => {
  it('reaches the final unload even when its display time rounds down', () => {
    const input = structuredClone(fixture);
    input.robot.speed = 1.5;
    const playback = new Playback(parseScenario(input));
    const final = playback.seek(playback.duration);
    expect(final.finished).toBe(true);
    expect(final.completedTasks).toBe(3);
    expect(final.robot.carrying).toBeNull();
  });
  it('is independent of how many render callbacks occur', () => {
    const many = new Playback(parseScenario(fixture));
    const one = new Playback(parseScenario(fixture));
    many.play(0);
    one.play(0);
    for (let at = 100; at <= 5000; at += 100) many.update(at);
    expect(many.snapshot()).toEqual(one.update(5000));
  });
  it('does not advance while paused, and preserves time on speed changes', () => {
    const playback = new Playback(parseScenario(fixture));
    playback.play(0);
    playback.setSpeed(10, 2000);
    expect(playback.update(3000).time).toBe(12);
    playback.pause(3000);
    expect(playback.update(9000).time).toBe(12);
    playback.play(9000);
    expect(playback.update(10000).time).toBe(22);
  });
  it('replays backwards by recreating the same deterministic state', () => {
    const playback = new Playback(parseScenario(fixture));
    const early = playback.seek(20);
    playback.seek(100);
    expect(playback.seek(20)).toEqual(early);
  });
  it('handles fractional anchors without reverse-clock rounding errors', () => {
    const playback = new Playback(parseScenario(fixture));
    playback.play(0);
    playback.update(1234.5678912345);
    playback.setSpeed(2, 1234.5678912345);
    expect(() => playback.update(1234.5678912345)).not.toThrow();
  });
  it('stops at completion and replays from the beginning', () => {
    const playback = new Playback(parseScenario(fixture));
    playback.play(0);
    expect(playback.update(1_000_000).finished).toBe(true);
    expect(playback.running).toBe(false);
    playback.play(1_000_000);
    expect(playback.snapshot().time).toBe(0);
  });
});
