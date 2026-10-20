import { useState } from 'react';
import { ContextLostOverlay } from '@/ui/hud/ContextLostOverlay';
import { PerfOverlay } from '@/ui/hud/PerfOverlay';
import { useUiStore } from '@/ui/hooks/useUiStore';
import { StatusBar } from '@/ui/layout/StatusBar';
import { TopBar } from '@/ui/layout/TopBar';
import { SettingsPanel } from '@/ui/settings/SettingsPanel';
import { Viewport } from '@/ui/common/Viewport';
import { useEngine } from '../engineContext';

/**
 * Simulator shell: top bar, central viewport, collapsible settings panel, status bar.
 * Re-renders only when the panel is toggled or the overlay setting changes; per-frame
 * work happens inside the engine, and live numbers update only their own components.
 */
export function SandboxScreen() {
  const engine = useEngine();
  const showPerf = useUiStore((s) => s.settings.interface.showPerfOverlay);
  const [panelOpen, setPanelOpen] = useState(true);

  if (!engine) return null;

  return (
    <div className="shell">
      <TopBar
        engine={engine}
        title="Sandbox"
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen((open) => !open)}
      />
      <div className="shell__main">
        <div className="shell__viewport">
          <Viewport engine={engine} />
          {showPerf && <PerfOverlay engine={engine} />}
          <ContextLostOverlay />
          <p className="viewport-hint">Drag to orbit · Right-drag to pan · Scroll to zoom</p>
        </div>
        {panelOpen && (
          <aside className="shell__panel" aria-label="Settings">
            <SettingsPanel />
          </aside>
        )}
      </div>
      <StatusBar engine={engine} />
    </div>
  );
}
