import { uiStore } from '@/state';
import { BrandMark } from '@/ui/common/BrandMark';

const UPCOMING = ['Play Match', 'Multiplayer', 'Robot Builder'] as const;

export function MainMenu() {
  return (
    <main className="menu">
      <div className="menu__panel panel">
        <BrandMark size={36} />
        <p className="menu__eyebrow">FRC 2026 · REBUILT</p>
        <h1 className="menu__title">FRC Sim</h1>
        <p className="menu__subtitle">Real-time robot and match simulator</p>

        <nav className="menu__actions">
          <button
            className="button button--primary"
            autoFocus
            onClick={() => uiStore.getState().setScreen('sandbox')}
          >
            Open Sandbox
          </button>
          {UPCOMING.map((label) => (
            <button key={label} className="button" disabled title="Coming in a later stage">
              {label}
              <span className="menu__soon">Soon</span>
            </button>
          ))}
        </nav>
      </div>
    </main>
  );
}
