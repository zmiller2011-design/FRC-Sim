import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Engine, RenderInitError } from '@/engine';
import { uiStore } from '@/state';
import { EngineContext, type EngineContextValue, type EngineStatus } from './engineContext';

function describeFailure(error: unknown): Extract<EngineStatus, { kind: 'error' }> {
  if (error instanceof RenderInitError) {
    return { kind: 'error', code: error.code, message: error.message };
  }
  return {
    kind: 'error',
    code: 'unknown',
    message: error instanceof Error ? error.message : String(error),
  };
}

/**
 * Creates the engine for the app's lifetime and bridges it to the UI store:
 * settings, pause and speed flow store -> engine; perf samples and render status flow
 * engine -> store. This is the only place where the two are connected.
 */
export function EngineProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<EngineStatus>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

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
        const store = uiStore.getState();
        created.setPaused(store.paused);
        created.setTimeScale(store.timeScale);
        created.setCameraMode(store.cameraView);
        store.setRenderStatus(created.renderStatus);

        teardowns.push(created.events.on('perf', (s) => uiStore.getState().publishPerf(s)));
        teardowns.push(
          created.events.on('renderStatus', (s) => uiStore.getState().setRenderStatus(s)),
        );
        teardowns.push(
          uiStore.subscribe((state, prev) => {
            if (state.settings !== prev.settings) created.applySettings(state.settings);
            if (state.paused !== prev.paused) created.setPaused(state.paused);
            if (state.timeScale !== prev.timeScale) created.setTimeScale(state.timeScale);
            if (state.cameraView !== prev.cameraView) created.setCameraMode(state.cameraView);
          }),
        );
        setStatus({ kind: 'ready', engine: created });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('Engine initialization failed', error);
        setStatus(describeFailure(error));
      });

    return () => {
      cancelled = true;
      for (const teardown of teardowns) teardown();
      engine?.dispose();
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setStatus({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo<EngineContextValue>(() => ({ status, retry }), [status, retry]);
  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}
