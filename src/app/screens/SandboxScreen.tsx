import { useState } from 'react';
import { ContextLostOverlay } from '@/ui/hud/ContextLostOverlay';
import { PerfOverlay } from '@/ui/hud/PerfOverlay';
import { RobotTelemetryPanel } from '@/ui/telemetry/RobotTelemetryPanel';
import { useUiStore } from '@/ui/hooks/useUiStore';
import { StatusBar } from '@/ui/layout/StatusBar';
import { TopBar } from '@/ui/layout/TopBar';
import { SettingsPanel } from '@/ui/settings/SettingsPanel';
import { Viewport } from '@/ui/common/Viewport';
import { useEngine } from '../engineContext';

const HINTS = {
  orbit: 'Drag to orbit · Right-drag to pan · Scroll to zoom',
  overhead: 'Drag to pan · Scroll to zoom',
  blueStation: 'Drag to look around',
  redStation: 'Drag to look around',
  follow: 'Camera follows the robot',
} as const;

function ViewportHint() {
  const view = useUiStore((s) => s.cameraView);
  return <p className="viewport-hint">WASD/QE drive · {HINTS[view]} · Views 1–5</p>;
}

/**
 * Simulator shell: top bar, central viewport, collapsible settings panel, status bar.
 * Re-renders only when the panel is toggled or the overlay setting changes; per-frame
 * work happens inside the engine, and live numbers update only their own components.
 */
export function SandboxScreen() {
  const engine = useEngine();
  const showPerf = useUiStore((s) => s.settings.interface.showPerfOverlay);
  const showTelemetry = useUiStore((s) => s.settings.interface.showRobotTelemetry);
  const [panelOpen, setPanelOpen] = useState(true);

  if (!engine) return null;

  return (
    <div className="shell">
      <TopBar
        engine={engine}
        title="REBUILT Field"
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen((open) => !open)}
      />
      <div className="shell__main">
        <div className="shell__viewport">
          <Viewport engine={engine} />
          {showPerf && <PerfOverlay engine={engine} />}
          {showTelemetry && <RobotTelemetryPanel />}
          <ContextLostOverlay />
          <ViewportHint />
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
