import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/random/Rng';

describe('Rng', () => {
  it('is reproducible for a seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('differs between seeds', () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  it('resumes from saved state', () => {
    const a = new Rng(7);
    a.next();
    const saved = a.getState();
    const expected = [a.next(), a.next()];
    const b = new Rng(0);
    b.setState(saved);
    expect([b.next(), b.next()]).toEqual(expected);
  });

  it('stays in range', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 1000; i++) {
      const f = rng.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = rng.int(-2, 2);
      expect(n).toBeGreaterThanOrEqual(-2);
      expect(n).toBeLessThanOrEqual(2);
    }
  });
});
