import type { Engine } from '@/engine';
import { type CameraView, uiStore } from '@/state';
import { BrandMark } from '../common/BrandMark';
import { Icon } from '../common/Icon';
import { useHotkey } from '../hooks/useHotkey';
import { useUiStore } from '../hooks/useUiStore';

const SPEEDS = [0.25, 0.5, 1, 2] as const;

const VIEWS: readonly { id: CameraView; label: string; key: string }[] = [
  { id: 'orbit', label: 'Orbit', key: 'Digit1' },
  { id: 'overhead', label: 'Overhead', key: 'Digit2' },
  { id: 'blueStation', label: 'Blue DS', key: 'Digit3' },
  { id: 'redStation', label: 'Red DS', key: 'Digit4' },
];

function togglePause(): void {
  const { paused, setPaused } = uiStore.getState();
  setPaused(!paused);
}

function togglePerfOverlay(): void {
  const { settings, updateSettings } = uiStore.getState();
  updateSettings({ interface: { showPerfOverlay: !settings.interface.showPerfOverlay } });
}

const setView = (view: CameraView) => () => uiStore.getState().setCameraView(view);

interface TopBarProps {
  engine: Engine;
  title: string;
  panelOpen: boolean;
  onTogglePanel(): void;
}

export function TopBar({ engine, title, panelOpen, onTogglePanel }: TopBarProps) {
  const paused = useUiStore((s) => s.paused);
  const timeScale = useUiStore((s) => s.timeScale);
  const cameraView = useUiStore((s) => s.cameraView);
  const perfVisible = useUiStore((s) => s.settings.interface.showPerfOverlay);

  useHotkey('KeyP', togglePause);
  useHotkey('Backquote', togglePerfOverlay);
  useHotkey('Digit1', setView('orbit'));
  useHotkey('Digit2', setView('overhead'));
  useHotkey('Digit3', setView('blueStation'));
  useHotkey('Digit4', setView('redStation'));

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
          <span className="topbar__label">{paused ? 'Resume' : 'Pause'}</span>
        </button>
        <div className="segmented topbar__speed" role="group" aria-label="Simulation speed">
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
        <div className="segmented" role="group" aria-label="Camera view">
          {VIEWS.map((v, i) => (
            <button
              key={v.id}
              className="segmented__item"
              aria-pressed={cameraView === v.id}
              onClick={setView(v.id)}
              title={`${v.label} view (${i + 1})`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="topbar__group">
        <button
          className="button"
          onClick={() => engine.resetField()}
          title="Return all FUEL to its starting positions"
        >
          <Icon name="reset" />
          <span className="topbar__label">Reset field</span>
        </button>
        <button
          className="button button--icon"
          onClick={() => engine.resetCamera()}
          aria-label="Reset view"
          title="Reset view"
        >
          <Icon name="camera" />
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
