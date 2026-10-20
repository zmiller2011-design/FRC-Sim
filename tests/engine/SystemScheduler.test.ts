import { describe, expect, it } from 'vitest';
import { SystemScheduler } from '@/engine/SystemScheduler';

describe('SystemScheduler', () => {
  it('runs phases in order and logic at the divided rate', () => {
    const scheduler = new SystemScheduler(4);
    const log: string[] = [];
    const sys = (name: string) => ({
      name,
      fixedUpdate: (dt: number, tick: number) => log.push(`${name}@${tick}:${dt}`),
    });
    scheduler.addFixed('physics', sys('physics'));
    scheduler.addFixed('logic', sys('logic'));
    scheduler.addFixed('rules', sys('rules'));

    for (let tick = 0; tick < 5; tick++) scheduler.runFixed(0.005, tick);

    expect(log.filter((l) => l.startsWith('logic'))).toEqual(['logic@0:0.02', 'logic@4:0.02']);
    expect(log.filter((l) => l.startsWith('physics'))).toHaveLength(5);
    expect(log.slice(0, 3)).toEqual(['logic@0:0.02', 'physics@0:0.005', 'rules@0:0.005']);
  });

  it('removes systems', () => {
    const scheduler = new SystemScheduler(1);
    let calls = 0;
    const remove = scheduler.addFixed('physics', { name: 'x', fixedUpdate: () => calls++ });
    scheduler.runFixed(0.01, 0);
    remove();
    scheduler.runFixed(0.01, 1);
    expect(calls).toBe(1);
  });
});
