import type { Engine } from '@/engine';
import { useUiStore } from '../hooks/useUiStore';

/** Shortens "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11)" for display. */
function shortGpuName(name: string): string {
  const angle = /^ANGLE \((?:[^,]+), (.+?)(?: Direct3D| \(0x|, ).*\)$/.exec(name);
  return (angle?.[1] ?? name).trim();
}

/** Live numbers update at the telemetry rate (10 Hz), re-rendering only this bar. */
export function StatusBar({ engine }: { engine: Engine }) {
  const paused = useUiStore((s) => s.paused);
  const timeScale = useUiStore((s) => s.timeScale);
  const renderStatus = useUiStore((s) => s.renderStatus);
  const preset = useUiStore((s) => s.settings.graphics.preset);
  const perf = useUiStore((s) => s.perf);

  const state = renderStatus === 'context-lost' ? 'lost' : paused ? 'paused' : ('running' as const);
  const label = { running: 'Running', paused: 'Paused', lost: 'Graphics context lost' }[state];
  const gpu = engine.gpuInfo.renderer;

  return (
    <footer className="statusbar">
      <div className="statusbar__group">
        <span className={`status-dot status-dot--${state}`} aria-hidden="true" />
        <span>{label}</span>
        <span className="statusbar__item">
          Sim time <b>{perf ? perf.simTime.toFixed(1) : '0.0'} s</b>
        </span>
        <span className="statusbar__item">
          Speed <b>{timeScale}×</b>
        </span>
      </div>
      <div className="statusbar__group">
        {perf && (
          <span className="statusbar__item">
            {perf.renderWidth}×{perf.renderHeight} @ {perf.pixelRatio.toFixed(2)}×
          </span>
        )}
        <span className="statusbar__item statusbar__preset">{preset}</span>
        <span className="statusbar__item statusbar__gpu" title={gpu}>
          WebGL 2 · {shortGpuName(gpu)}
        </span>
      </div>
    </footer>
  );
}
