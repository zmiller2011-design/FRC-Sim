import { useStore } from 'zustand';
import { uiStore, type UiState } from '@/state';

/** Subscribes a component to a slice of UI state. Keep selectors narrow to avoid re-renders. */
export function useUiStore<T>(selector: (state: UiState) => T): T {
  return useStore(uiStore, selector);
}
