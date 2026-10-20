import { useState } from 'react';
import type { RenderErrorCode } from '@/engine';
import { BrandMark } from '@/ui/common/BrandMark';

interface Advice {
  title: string;
  steps: string[];
}

const ADVICE: Record<RenderErrorCode | 'unknown', Advice> = {
  'webgl2-unsupported': {
    title: 'Your browser does not support 3D graphics',
    steps: [
      'Update to the latest Chrome, Edge or Firefox.',
      'If you are using an embedded or in-app browser, open this page in a full browser.',
    ],
  },
  'webgl-blocked': {
    title: '3D graphics are turned off or blocked',
    steps: [
      'Turn on hardware acceleration. In Chrome or Edge: Settings → System → "Use graphics acceleration when available", then restart the browser.',
      'Update your graphics driver from NVIDIA, AMD or Intel.',
      'In Chrome, open chrome://gpu and check that WebGL2 shows "Hardware accelerated".',
    ],
  },
  'context-creation-failed': {
    title: 'The 3D renderer could not start',
    steps: [
      'Close other tabs that use 3D graphics, then try again.',
      'Restart the browser.',
      'Update your graphics driver.',
    ],
  },
  unknown: {
    title: 'Something went wrong while starting the simulator',
    steps: ['Try again. If the problem continues, reload the page.'],
  },
};

interface ErrorScreenProps {
  code: RenderErrorCode | 'unknown';
  message: string;
  onRetry(): void;
}

export function ErrorScreen({ code, message, onRetry }: ErrorScreenProps) {
  const advice = ADVICE[code];
  const [copied, setCopied] = useState(false);

  const details = `${code}: ${message}\n${navigator.userAgent}`;
  const copy = () => {
    navigator.clipboard?.writeText(details).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  return (
    <main className="splash">
      <section className="splash__content splash__content--error panel" role="alert">
        <BrandMark size={32} />
        <h1 className="error__title">{advice.title}</h1>
        <p className="error__message">{message}</p>
        <h2 className="error__heading">What to try</h2>
        <ol className="error__steps">
          {advice.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="error__actions">
          <button className="button button--primary" onClick={onRetry}>
            Try again
          </button>
          <button className="button" onClick={copy}>
            {copied ? 'Copied' : 'Copy details'}
          </button>
        </div>
        <details className="error__details">
          <summary>Technical details</summary>
          <pre>{details}</pre>
        </details>
      </section>
    </main>
  );
}
