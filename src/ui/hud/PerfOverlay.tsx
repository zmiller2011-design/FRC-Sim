import { useUiStore } from '../hooks/useUiStore';

function format(value: number, digits = 0): string {
  return value.toFixed(digits);
}

/** Updates at the telemetry rate (default 10 Hz), never per frame. */
export function PerfOverlay() {
  const perf = useUiStore((s) => s.perf);
  const physicsHz = useUiStore((s) => s.settings.simulation.physicsHz);

  if (!perf) return null;

  const rows: [string, string][] = [
    ['FPS', format(perf.fps)],
    ['Frame', `${format(perf.frameMs, 1)} ms (worst ${format(perf.worstFrameMs, 1)})`],
    ['CPU', `${format(perf.cpuMs, 2)} ms`],
    ['Sim steps', `${format(perf.stepsPerSecond)} / ${physicsHz} Hz`],
    ['Draw calls', format(perf.drawCalls)],
    ['Triangles', format(perf.triangles)],
    ['GPU objects', `${perf.geometries} geo · ${perf.textures} tex`],
  ];

  return (
    <dl className="panel perf">
      {rows.map(([label, value]) => (
        <div key={label} className="perf__row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
      {perf.droppedSeconds > 0 && (
        <div className="perf__row perf__row--warn">
          <dt>Dropped</dt>
          <dd>{format(perf.droppedSeconds * 1000)} ms sim time</dd>
        </div>
      )}
    </dl>
  );
}
