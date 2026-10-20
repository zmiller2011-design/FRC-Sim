import { useUiStore } from '../hooks/useUiStore';
import { ModuleDiagram } from './ModuleDiagram';

const f = (v: number, d = 2) => (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d);

/** Developer telemetry for the driven robot. Updates at the telemetry rate, not per frame. */
export function RobotTelemetryPanel() {
  const t = useUiStore((s) => s.robot);
  if (!t) return null;

  const rows: [string, string][] = [
    ['Speed', `${f(t.speed)} m/s`],
    ['Vel (field)', `${f(t.vx)}, ${f(t.vy)} m/s`],
    ['Vel (robot)', `${f(t.vxRobot)}, ${f(t.vyRobot)} m/s`],
    ['Accel', `${f(t.accel, 1)} m/s² (${f(t.ax, 1)}, ${f(t.ay, 1)})`],
    ['Heading', `${f(t.headingDeg, 1)}°`],
    ['Ang. vel', `${f(t.omegaDegPs, 0)}°/s`],
    ['Ang. accel', `${f(t.alphaDegPs2, 0)}°/s²`],
    ['Pose', `${f(t.x)}, ${f(t.y)} m`],
    ['Timestep', `${t.dtMs.toFixed(2)} ms · ${t.physicsHz} Hz phys · ${f(t.controlHz, 0)} Hz ctrl`],
  ];

  return (
    <section className="panel telemetry" aria-label="Robot telemetry">
      <header className="telemetry__header">
        <h2>Robot telemetry</h2>
        <div className="telemetry__chips">
          <span className="chip">{t.command.fieldRelative ? 'Field-rel' : 'Robot-rel'}</span>
          <span className="chip">{t.neutralMode === 'brake' ? 'Brake' : 'Coast'}</span>
          {t.command.xLock && <span className="chip chip--accent">X-lock</span>}
          {t.neutral && !t.command.xLock && <span className="chip chip--muted">Neutral</span>}
          {t.contacts > 0 && <span className="chip chip--warn">Contact</span>}
        </div>
      </header>
      <div className="telemetry__body">
        <dl className="telemetry__rows">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <ModuleDiagram modules={t.modules} maxSpeed={4.5} />
      </div>
      <table className="telemetry__modules">
        <thead>
          <tr>
            <th scope="col">Module</th>
            <th scope="col">Angle</th>
            <th scope="col">Target</th>
            <th scope="col">Speed</th>
            <th scope="col">Current</th>
          </tr>
        </thead>
        <tbody>
          {t.modules.map((m) => (
            <tr key={m.name} className={m.slipping ? 'telemetry__slip' : undefined}>
              <th scope="row">{m.name}</th>
              <td>{f(m.angleDeg, 0)}°</td>
              <td>{f(m.targetAngleDeg, 0)}°</td>
              <td>{f(m.speed)} m/s</td>
              <td>{f(m.currentA, 0)} A</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="telemetry__hint">
        {t.gamepad
          ? `Gamepad: ${t.gamepad}`
          : 'WASD drive · Q/E rotate · Shift slow · Space X-lock'}
      </p>
    </section>
  );
}
