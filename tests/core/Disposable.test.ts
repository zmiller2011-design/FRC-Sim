import { describe, expect, it } from 'vitest';
import { DisposalScope } from '@/core/resources/Disposable';

describe('DisposalScope', () => {
  it('disposes in reverse order, once', () => {
    const order: number[] = [];
    const scope = new DisposalScope();
    scope.defer(() => order.push(1));
    scope.add({ dispose: () => order.push(2) });
    scope.dispose();
    scope.dispose();
    expect(order).toEqual([2, 1]);
  });

  it('runs every teardown even if one throws, then rethrows', () => {
    const order: number[] = [];
    const scope = new DisposalScope();
    scope.defer(() => order.push(1));
    scope.defer(() => {
      throw new Error('boom');
    });
    scope.defer(() => order.push(3));
    expect(() => scope.dispose()).toThrow('boom');
    expect(order).toEqual([3, 1]);
  });

  it('immediately runs teardowns added after disposal', () => {
    const scope = new DisposalScope();
    scope.dispose();
    let ran = false;
    scope.defer(() => (ran = true));
    expect(ran).toBe(true);
  });
});
