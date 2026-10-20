import { useUiStore } from '../hooks/useUiStore';

export function ContextLostOverlay() {
  const lost = useUiStore((s) => s.renderStatus === 'context-lost');
  if (!lost) return null;
  return (
    <div className="viewport-overlay" role="alert">
      <div className="panel viewport-overlay__card">
        <h2>Graphics context lost</h2>
        <p>
          The graphics driver reset or the GPU changed. The simulator is waiting for the browser to
          restore 3D rendering. If this doesn&apos;t recover in a few seconds, reload the page.
        </p>
      </div>
    </div>
  );
}
