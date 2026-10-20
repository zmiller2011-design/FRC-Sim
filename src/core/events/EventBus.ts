type Listener<T> = (payload: T) => void;

/**
 * Typed synchronous pub/sub.
 * Listener arrays are copy-on-write, so `emit` never allocates and listeners
 * may safely subscribe or unsubscribe while an event is being dispatched.
 */
export class EventBus<Events extends object> {
  private readonly listeners = new Map<keyof Events, readonly Listener<never>[]>();

  on<K extends keyof Events>(type: K, listener: Listener<Events[K]>): () => void {
    const current = this.listeners.get(type) ?? [];
    this.listeners.set(type, [...current, listener as Listener<never>]);
    return () => this.off(type, listener);
  }

  once<K extends keyof Events>(type: K, listener: Listener<Events[K]>): () => void {
    const off = this.on(type, (payload) => {
      off();
      listener(payload);
    });
    return off;
  }

  off<K extends keyof Events>(type: K, listener: Listener<Events[K]>): void {
    const current = this.listeners.get(type);
    if (!current) return;
    const next = current.filter((l) => l !== listener);
    if (next.length === 0) this.listeners.delete(type);
    else this.listeners.set(type, next);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const current = this.listeners.get(type) as readonly Listener<Events[K]>[] | undefined;
    if (!current) return;
    for (let i = 0; i < current.length; i++) current[i]!(payload);
  }

  listenerCount(type: keyof Events): number {
    return this.listeners.get(type)?.length ?? 0;
  }

  clear(): void {
    this.listeners.clear();
  }
}
