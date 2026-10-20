import { uiStore } from '@/state';
import { useEngineStatus } from '../engineContext';

const UPCOMING = ['Play Match', 'Multiplayer', 'Robot Builder'] as const;

export function MainMenu() {
  const status = useEngineStatus();
  const ready = status.kind === 'ready';

  return (
    <main className="menu">
      <div className="menu__panel panel">
        <p className="menu__eyebrow">FRC 2026 · REBUILT</p>
        <h1 className="menu__title">FRC Sim</h1>
        <p className="menu__subtitle">Real-time robot and match simulator</p>

        <nav className="menu__actions">
          <button
            className="button button--primary"
            disabled={!ready}
            onClick={() => uiStore.getState().setScreen('sandbox')}
          >
            {ready ? 'Open Sandbox' : 'Loading engine…'}
          </button>
          {UPCOMING.map((label) => (
            <button key={label} className="button" disabled title="Coming in a later stage">
              {label}
            </button>
          ))}
        </nav>

        {status.kind === 'error' && (
          <p className="menu__error" role="alert">
            The simulator could not start: {status.message}
          </p>
        )}
      </div>
    </main>
  );
}
