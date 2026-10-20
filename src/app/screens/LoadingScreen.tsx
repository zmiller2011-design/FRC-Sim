import { BrandMark } from '@/ui/common/BrandMark';

export function LoadingScreen() {
  return (
    <main className="splash" aria-busy="true" aria-live="polite">
      <div className="splash__content">
        <BrandMark size={44} />
        <h1 className="splash__title">FRC Sim</h1>
        <div className="progress" role="progressbar" aria-label="Loading">
          <div className="progress__bar" />
        </div>
        <p className="splash__caption">Starting 3D engine…</p>
      </div>
    </main>
  );
}
