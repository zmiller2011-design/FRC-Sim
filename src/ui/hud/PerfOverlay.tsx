import type { Engine } from '@/engine';
import { useUiStore } from '../hooks/useUiStore';
import { FrameTimeGraph } from './FrameTimeGraph';

function fixed(value: number, digits = 0): string {
  return value.toFixed(digits);
}

/** Diagnostics overlay. Numbers update at the telemetry rate (10 Hz), never per frame. */
export function PerfOverlay({ engine }: { engine: Engine }) {
  const perf = useUiStore((s) => s.perf);
  const physicsHz = useUiStore((s) => s.settings.simulation.physicsHz);

  const fpsClass =
    !perf || perf.fps >= 55 ? '' : perf.fps >= 30 ? 'perf__value--warn' : 'perf__value--bad';

  return (
    <section className="panel perf" aria-label="Performance diagnostics">
      <div className="perf__headline">
        <span className={`perf__fps ${fpsClass}`}>{perf ? fixed(perf.fps) : '–'}</span>
        <span className="perf__unit">FPS</span>
        <span className="perf__frame">{perf ? `${fixed(perf.frameMs, 1)} ms` : ''}</span>
      </div>
      <FrameTimeGraph engine={engine} />
      {perf && (
        <dl className="perf__rows">
          <dt>Worst frame</dt>
          <dd>{fixed(perf.worstFrameMs, 1)} ms</dd>
          <dt>CPU / frame</dt>
          <dd>{fixed(perf.cpuMs, 2)} ms</dd>
          <dt>Sim steps</dt>
          <dd>
            {fixed(perf.stepsPerSecond)} / {physicsHz} Hz
          </dd>
          <dt>Draw calls</dt>
          <dd>{perf.drawCalls}</dd>
          <dt>Triangles</dt>
          <dd>{perf.triangles.toLocaleString()}</dd>
          <dt>GPU memory</dt>
          <dd>
            {perf.geometries} geo · {perf.textures} tex
          </dd>
          {perf.droppedSeconds > 0 && (
            <>
              <dt className="perf__value--warn">Sim behind</dt>
              <dd className="perf__value--warn">{fixed(perf.droppedSeconds * 1000)} ms dropped</dd>
            </>
          )}
        </dl>
      )}
    </section>
  );
}
