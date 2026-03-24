import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { ChatPanel } from './components/chat/ChatPanel';
import { SourcesPanel } from './components/sources/SourcesPanel';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { NotesPanel } from './components/notes/NotesPanel';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { useTheme } from './hooks/use-theme';
import { useAuthConfig } from './hooks/use-auth-config';
import { CollectionProvider } from './context/CollectionContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { setAuthToken, setUnauthorizedHandler } from './api/client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

type View = 'chat' | 'sources' | 'settings' | 'notes';
type AuthView = 'login' | 'register';

/**
 * Inner shell that renders the appropriate view based on auth state.
 * Sits inside AuthProvider so it can call useAuth().
 */
function AppShell() {
  const [view, setView] = useState<View>('chat');
  const [authView, setAuthView] = useState<AuthView>('login');
  const { authEnabled, isLoading: authConfigLoading } = useAuthConfig();
  const { isAuthenticated, isLoading: authStateLoading, token, logout } = useAuth();

  // Initialize theme at top level so it applies on mount
  useTheme();

  // Keep the API client token in sync with auth state
  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  // Register a handler so the API client can clear the session on 401
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });
    return () => {
      setUnauthorizedHandler(null);
    };
  }, [logout]);

  // While we're checking config or auth state, render nothing (avoids flash)
  if (authConfigLoading || authStateLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#05070A' }}
      >
        <span
          className="font-mono text-[9px] uppercase tracking-widest animate-pulse"
          style={{ color: '#4a5568' }}
        >
          Initializing...
        </span>
      </div>
    );
  }

  // When auth is enabled and the user is not authenticated, show the auth pages
  if (authEnabled && !isAuthenticated) {
    if (authView === 'register') {
      return (
        <RegisterPage onNavigateToLogin={() => setAuthView('login')} />
      );
    }
    return (
      <LoginPage onNavigateToRegister={() => setAuthView('register')} />
    );
  }

  // Normal app shell
  return (
    <Layout activeView={view} onNavigate={setView}>
      {view === 'chat' && <ChatPanel />}
      {view === 'sources' && <SourcesPanel />}
      {view === 'notes' && <NotesPanel />}
      {view === 'settings' && <SettingsPanel />}
    </Layout>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CollectionProvider>
          <AppShell />
        </CollectionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
