import type { ModuleTelemetry } from '@/state';

const SIZE = 132;
const HALF = SIZE / 2;
/** Module centres in the diagram (robot forward = up, robot left = left). */
const SPOTS: Record<string, [number, number]> = {
  FL: [HALF - 36, HALF - 36],
  FR: [HALF + 36, HALF - 36],
  BL: [HALF - 36, HALF + 36],
  BR: [HALF + 36, HALF + 36],
};
const MAX_ARROW = 26;

/**
 * Top-down sketch of the four modules in the robot frame. Solid arrows show the measured
 * steering angle with length ∝ wheel speed; faint lines show the targets.
 */
export function ModuleDiagram({
  modules,
  maxSpeed,
}: {
  modules: readonly ModuleTelemetry[];
  maxSpeed: number;
}) {
  return (
    <svg
      className="module-diagram"
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label="Swerve module angles and speeds"
    >
      <rect
        x={HALF - 50}
        y={HALF - 50}
        width={100}
        height={100}
        rx={8}
        className="module-diagram__frame"
      />
      <path d={`M ${HALF} ${HALF - 44} l -6 9 h 12 z`} className="module-diagram__front" />
      {modules.map((m) => {
        const spot = SPOTS[m.name];
        if (!spot) return null;
        const [cx, cy] = spot;
        // Robot-frame angle (CCW from forward) → screen direction (up = forward, left = +Y).
        const dir = (deg: number) => {
          const a = (deg * Math.PI) / 180;
          return [-Math.sin(a), -Math.cos(a)] as const;
        };
        const [dx, dy] = dir(m.angleDeg);
        const [tx, ty] = dir(m.targetAngleDeg);
        const sign = m.speed < 0 ? -1 : 1;
        const length = 8 + (Math.min(Math.abs(m.speed), maxSpeed) / maxSpeed) * MAX_ARROW;
        return (
          <g key={m.name}>
            <circle
              cx={cx}
              cy={cy}
              r={11}
              className={`module-diagram__pod ${m.slipping ? 'module-diagram__pod--slip' : ''}`}
            />
            <line
              x1={cx - tx * 14}
              y1={cy - ty * 14}
              x2={cx + tx * 14}
              y2={cy + ty * 14}
              className="module-diagram__target"
            />
            <line
              x1={cx}
              y1={cy}
              x2={cx + sign * dx * length}
              y2={cy + sign * dy * length}
              className="module-diagram__vector"
              markerEnd="url(#module-arrow)"
            />
            <text x={cx} y={cy + 4} className="module-diagram__label">
              {m.name}
            </text>
          </g>
        );
      })}
      <defs>
        <marker
          id="module-arrow"
          viewBox="0 0 6 6"
          refX="5"
          refY="3"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L6,3 L0,6 z" className="module-diagram__head" />
        </marker>
      </defs>
    </svg>
  );
}
