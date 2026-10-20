import { createContext, useContext } from 'react';
import type { Engine } from '@/engine';

export type EngineStatus =
  { kind: 'loading' } | { kind: 'ready'; engine: Engine } | { kind: 'error'; message: string };

export const EngineContext = createContext<EngineStatus>({ kind: 'loading' });

export function useEngineStatus(): EngineStatus {
  return useContext(EngineContext);
}
