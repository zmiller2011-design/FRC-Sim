import { useEffect, useRef } from 'react';
import type { Engine } from '@/engine';

/** Hosts the engine's canvas. React renders this once; the engine draws into it imperatively. */
export function Viewport({ engine }: { engine: Engine }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    engine.mount(container);
    return () => engine.unmount();
  }, [engine]);

  return <div ref={containerRef} className="viewport" />;
}
