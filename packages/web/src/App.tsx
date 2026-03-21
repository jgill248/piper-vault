import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { ChatPanel } from './components/chat/ChatPanel';
import { SourcesPanel } from './components/sources/SourcesPanel';
import { SettingsPanel } from './components/settings/SettingsPanel';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

type View = 'chat' | 'sources' | 'settings';

export function App() {
  const [view, setView] = useState<View>('chat');

  return (
    <QueryClientProvider client={queryClient}>
      <Layout activeView={view} onNavigate={setView}>
        {view === 'chat' && <ChatPanel />}
        {view === 'sources' && <SourcesPanel />}
        {view === 'settings' && <SettingsPanel />}
      </Layout>
    </QueryClientProvider>
  );
}
