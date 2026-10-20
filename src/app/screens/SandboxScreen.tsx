import { useState } from 'react';
import { uiStore } from '@/state';
import { PerfOverlay } from '@/ui/hud/PerfOverlay';
import { SimControls } from '@/ui/hud/SimControls';
import { Viewport } from '@/ui/common/Viewport';
import { SettingsPanel } from '@/ui/settings/SettingsPanel';
import { useUiStore } from '@/ui/hooks/useUiStore';
import { useEngineStatus } from '../engineContext';

export function SandboxScreen() {
  const status = useEngineStatus();
  const showPerf = useUiStore((s) => s.settings.interface.showPerfOverlay);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (status.kind !== 'ready') return null;

  return (
    <div className="screen">
      <Viewport engine={status.engine} />
      <div className="hud">
        <div className="hud__top-left">
          <button className="button" onClick={() => uiStore.getState().setScreen('menu')}>
            ← Menu
          </button>
          <SimControls />
        </div>
        <div className="hud__top-right">
          <button
            className="button"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            Settings
          </button>
          {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
        </div>
        {showPerf && (
          <div className="hud__bottom-left">
            <PerfOverlay />
          </div>
        )}
      </div>
    </div>
  );
}
