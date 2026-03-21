import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { ChatPanel } from './components/chat/ChatPanel';
import { SourcesPanel } from './components/sources/SourcesPanel';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { useTheme } from './hooks/use-theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

type View = 'chat' | 'sources' | 'settings';

function AppShell() {
  const [view, setView] = useState<View>('chat');
  // Initialize theme at top level so it applies on mount
  useTheme();

  return (
    <Layout activeView={view} onNavigate={setView}>
      {view === 'chat' && <ChatPanel />}
      {view === 'sources' && <SourcesPanel />}
      {view === 'settings' && <SettingsPanel />}
    </Layout>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}
