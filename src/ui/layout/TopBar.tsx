import type { Engine } from '@/engine';
import { uiStore } from '@/state';
import { BrandMark } from '../common/BrandMark';
import { Icon } from '../common/Icon';
import { useHotkey } from '../hooks/useHotkey';
import { useUiStore } from '../hooks/useUiStore';

const SPEEDS = [0.25, 0.5, 1, 2] as const;

function togglePause(): void {
  const { paused, setPaused } = uiStore.getState();
  setPaused(!paused);
}

function togglePerfOverlay(): void {
  const { settings, updateSettings } = uiStore.getState();
  updateSettings({ interface: { showPerfOverlay: !settings.interface.showPerfOverlay } });
}

interface TopBarProps {
  engine: Engine;
  title: string;
  panelOpen: boolean;
  onTogglePanel(): void;
}

export function TopBar({ engine, title, panelOpen, onTogglePanel }: TopBarProps) {
  const paused = useUiStore((s) => s.paused);
  const timeScale = useUiStore((s) => s.timeScale);
  const perfVisible = useUiStore((s) => s.settings.interface.showPerfOverlay);

  useHotkey('KeyP', togglePause);
  useHotkey('Backquote', togglePerfOverlay);

  return (
    <header className="topbar">
      <div className="topbar__group">
        <button
          className="button button--icon"
          onClick={() => uiStore.getState().setScreen('menu')}
          aria-label="Back to menu"
          title="Back to menu"
        >
          <Icon name="back" />
        </button>
        <BrandMark size={22} />
        <span className="topbar__brand">FRC Sim</span>
        <span className="topbar__divider" aria-hidden="true" />
        <span className="topbar__title">{title}</span>
      </div>

      <div className="topbar__group">
        <button
          className={`button ${paused ? 'button--primary' : ''}`}
          onClick={togglePause}
          title="Pause / resume (P)"
        >
          <Icon name={paused ? 'play' : 'pause'} />
          {paused ? 'Resume' : 'Pause'}
        </button>
        <div className="segmented" role="group" aria-label="Simulation speed">
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              className="segmented__item"
              aria-pressed={timeScale === speed}
              onClick={() => uiStore.getState().setTimeScale(speed)}
            >
              {speed}×
            </button>
          ))}
        </div>
      </div>

      <div className="topbar__group">
        <button className="button" onClick={() => engine.resetCamera()} title="Reset camera">
          <Icon name="camera" />
          Reset view
        </button>
        <button
          className="button button--icon"
          aria-pressed={perfVisible}
          onClick={togglePerfOverlay}
          aria-label="Diagnostics overlay"
          title="Diagnostics overlay (`)"
        >
          <Icon name="gauge" />
        </button>
        <button
          className="button button--icon"
          aria-pressed={panelOpen}
          onClick={onTogglePanel}
          aria-label="Settings panel"
          title="Settings panel"
        >
          <Icon name="panel" />
        </button>
      </div>
    </header>
  );
}
