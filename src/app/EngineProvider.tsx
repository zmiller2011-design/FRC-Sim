import { type ReactNode, useEffect, useState } from 'react';
import { Engine } from '@/engine';
import { uiStore } from '@/state';
import { EngineContext, type EngineStatus } from './engineContext';

/**
 * Creates the engine once for the app's lifetime and bridges it to the UI store:
 * settings and pause flow store -> engine; performance samples flow engine -> store.
 * This is the only place where the two are connected.
 */
export function EngineProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<EngineStatus>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    let engine: Engine | null = null;
    const teardowns: (() => void)[] = [];

    Engine.create({ settings: uiStore.getState().settings })
      .then((created) => {
        if (cancelled) {
          created.dispose();
          return;
        }
        engine = created;
        const { publishPerf } = uiStore.getState();
        teardowns.push(created.events.on('perf', publishPerf));
        teardowns.push(
          uiStore.subscribe((state, prev) => {
            if (state.settings !== prev.settings) created.applySettings(state.settings);
            if (state.paused !== prev.paused) created.setPaused(state.paused);
          }),
        );
        created.setPaused(uiStore.getState().paused);
        setStatus({ kind: 'ready', engine: created });
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatus({ kind: 'error', message: String(error) });
      });

    return () => {
      cancelled = true;
      for (const teardown of teardowns) teardown();
      engine?.dispose();
    };
  }, []);

  return <EngineContext.Provider value={status}>{children}</EngineContext.Provider>;
}
