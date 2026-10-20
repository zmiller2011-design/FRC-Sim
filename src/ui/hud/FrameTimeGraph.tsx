import { useEffect, useRef } from 'react';
import type { Engine } from '@/engine';

const WIDTH = 216;
const HEIGHT = 44;
/** Reference lines: 60 fps and 30 fps budgets. */
const BUDGETS_MS = [1000 / 60, 1000 / 30];
const MAX_MS = 50;

/**
 * Draws recent frame times straight from the engine's ring buffer onto a canvas.
 * Redraws only when the engine publishes a perf sample (10 Hz), without involving React.
 */
export function FrameTimeGraph({ engine }: { engine: Engine }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    const styles = getComputedStyle(canvas);
    const lineColor = styles.getPropertyValue('--accent').trim() || '#f2b33d';
    const gridColor = styles.getPropertyValue('--border-strong').trim() || '#444';
    const y = (ms: number) => HEIGHT - (Math.min(ms, MAX_MS) / MAX_MS) * HEIGHT;

    const draw = () => {
      const { samples, head } = engine.frameHistory;
      const n = samples.length;
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      for (const budget of BUDGETS_MS) {
        const by = Math.round(y(budget)) + 0.5;
        ctx.moveTo(0, by);
        ctx.lineTo(WIDTH, by);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < n; i++) {
        const ms = samples[(head + i) % n]!;
        if (Number.isNaN(ms)) continue; // not yet recorded
        const x = (i / (n - 1)) * WIDTH;
        if (started) ctx.lineTo(x, y(ms));
        else ctx.moveTo(x, y(ms));
        started = true;
      }
      ctx.stroke();
    };

    draw();
    return engine.events.on('perf', draw);
  }, [engine]);

  return (
    <canvas
      ref={canvasRef}
      className="frame-graph"
      style={{ width: WIDTH, height: HEIGHT }}
      role="img"
      aria-label="Frame time over the last few seconds; dashed lines mark 60 and 30 fps"
    />
  );
}
