import { useEffect } from 'react';
import { uiStore } from '@/state';
import { useUiStore } from '../hooks/useUiStore';

function togglePause(): void {
  const { paused, setPaused } = uiStore.getState();
  setPaused(!paused);
}

export function SimControls() {
  const paused = useUiStore((s) => s.paused);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'KeyP' && !event.repeat) togglePause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <button className="button" onClick={togglePause} title="Pause / resume (P)">
      {paused ? '▶ Resume' : '❚❚ Pause'}
    </button>
  );
}
