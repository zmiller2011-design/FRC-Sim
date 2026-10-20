import { useUiStore } from '@/ui/hooks/useUiStore';
import { useEngineContext } from './engineContext';
import { EngineProvider } from './EngineProvider';
import { ErrorScreen } from './screens/ErrorScreen';
import { LoadingScreen } from './screens/LoadingScreen';
import { MainMenu } from './screens/MainMenu';
import { SandboxScreen } from './screens/SandboxScreen';

export function App() {
  return (
    <EngineProvider>
      <EngineGate />
    </EngineProvider>
  );
}

/** Nothing below this renders until the engine is ready or has failed. */
function EngineGate() {
  const { status, retry } = useEngineContext();
  switch (status.kind) {
    case 'loading':
      return <LoadingScreen />;
    case 'error':
      return <ErrorScreen code={status.code} message={status.message} onRetry={retry} />;
    case 'ready':
      return <ScreenRouter />;
  }
}

function ScreenRouter() {
  const screen = useUiStore((s) => s.screen);
  switch (screen) {
    case 'menu':
      return <MainMenu />;
    case 'sandbox':
      return <SandboxScreen />;
  }
}
