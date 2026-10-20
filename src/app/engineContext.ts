import { createContext, useContext } from 'react';
import type { Engine, RenderErrorCode } from '@/engine';

export type EngineStatus =
  | { kind: 'loading' }
  | { kind: 'ready'; engine: Engine }
  | { kind: 'error'; code: RenderErrorCode | 'unknown'; message: string };

export interface EngineContextValue {
  status: EngineStatus;
  /** Disposes any engine and starts a fresh initialization attempt. */
  retry(): void;
}

export const EngineContext = createContext<EngineContextValue>({
  status: { kind: 'loading' },
  retry: () => {},
});

export function useEngineContext(): EngineContextValue {
  return useContext(EngineContext);
}

/** For components that only render once the engine is ready. */
export function useEngine(): Engine | null {
  const { status } = useContext(EngineContext);
  return status.kind === 'ready' ? status.engine : null;
}
