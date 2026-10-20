import { useUiStore } from '@/ui/hooks/useUiStore';
import { EngineProvider } from './EngineProvider';
import { MainMenu } from './screens/MainMenu';
import { SandboxScreen } from './screens/SandboxScreen';

export function App() {
  return (
    <EngineProvider>
      <ScreenRouter />
    </EngineProvider>
  );
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
