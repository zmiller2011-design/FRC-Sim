import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '@/core/events/EventBus';

interface Events {
  scored: { points: number };
  reset: undefined;
}

describe('EventBus', () => {
  it('delivers payloads to subscribers in order', () => {
    const bus = new EventBus<Events>();
    const calls: string[] = [];
    bus.on('scored', (e) => calls.push(`a${e.points}`));
    bus.on('scored', (e) => calls.push(`b${e.points}`));
    bus.emit('scored', { points: 3 });
    expect(calls).toEqual(['a3', 'b3']);
  });

  it('unsubscribes via the returned function', () => {
    const bus = new EventBus<Events>();
    const fn = vi.fn();
    const off = bus.on('reset', fn);
    off();
    bus.emit('reset', undefined);
    expect(fn).not.toHaveBeenCalled();
    expect(bus.listenerCount('reset')).toBe(0);
  });

  it('allows unsubscribing during dispatch without skipping others', () => {
    const bus = new EventBus<Events>();
    const second = vi.fn();
    const off = bus.on('reset', () => off());
    bus.on('reset', second);
    bus.emit('reset', undefined);
    expect(second).toHaveBeenCalledOnce();
  });

  it('once fires a single time', () => {
    const bus = new EventBus<Events>();
    const fn = vi.fn();
    bus.once('scored', fn);
    bus.emit('scored', { points: 1 });
    bus.emit('scored', { points: 2 });
    expect(fn).toHaveBeenCalledExactlyOnceWith({ points: 1 });
  });
});
