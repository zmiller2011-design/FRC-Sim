/** Anything that holds resources (GPU buffers, listeners, WASM memory) that must be released. */
export interface Disposable {
  dispose(): void;
}

/**
 * Collects disposables and teardown callbacks, then releases them in reverse order.
 * A failing teardown does not stop the others; the first error is rethrown at the end.
 */
export class DisposalScope implements Disposable {
  private readonly teardowns: (() => void)[] = [];
  private disposed = false;

  add<T extends Disposable>(resource: T): T {
    this.defer(() => resource.dispose());
    return resource;
  }

  defer(teardown: () => void): void {
    if (this.disposed) {
      teardown();
      return;
    }
    this.teardowns.push(teardown);
  }

  /** Registers a DOM listener and removes it on dispose. */
  listen<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    listener: (event: WindowEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void;
  listen<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    listener: (event: DocumentEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void;
  listen(
    target: EventTarget,
    type: string,
    listener: (event: Event) => void,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, listener, options);
    this.defer(() => target.removeEventListener(type, listener, options));
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    let firstError: unknown = undefined;
    let failed = false;
    for (let i = this.teardowns.length - 1; i >= 0; i--) {
      try {
        this.teardowns[i]!();
      } catch (error) {
        if (!failed) firstError = error;
        failed = true;
      }
    }
    this.teardowns.length = 0;
    if (failed) throw firstError;
  }
}
