import { useState, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { ChatPanel } from './components/chat/ChatPanel';
import { SourcesPanel } from './components/sources/SourcesPanel';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { NotesPanel } from './components/notes/NotesPanel';
import { GraphPanel } from './components/graph/GraphPanel';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { useTheme } from './hooks/use-theme';
import { useAuthConfig } from './hooks/use-auth-config';
import { useVaultStatus } from './hooks/use-vault-status';
import { CollectionProvider } from './context/CollectionContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { NavigationProvider } from './context/NavigationContext';
import { setAuthToken, setUnauthorizedHandler } from './api/client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

type View = 'chat' | 'sources' | 'settings' | 'notes' | 'graph';

/**
 * When the vault is empty and the user hasn't navigated yet,
 * redirect from chat to sources to encourage vault-building.
 */
function VaultRedirect({
  view,
  setView,
  redirected,
}: {
  view: View;
  setView: (v: View) => void;
  redirected: React.MutableRefObject<boolean>;
}) {
  const { isEmpty, isLoading } = useVaultStatus();

  useEffect(() => {
    if (!isLoading && isEmpty && view === 'chat' && !redirected.current) {
      redirected.current = true;
      setView('sources');
    }
  }, [isEmpty, isLoading, view, setView, redirected]);

  return null;
}
type AuthView = 'login' | 'register';

/**
 * Inner shell that renders the appropriate view based on auth state.
 * Sits inside AuthProvider so it can call useAuth().
 */
function AppShell() {
  const [view, setView] = useState<View>('chat');
  const [authView, setAuthView] = useState<AuthView>('login');
  const vaultRedirected = useRef(false);
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest animate-pulse">
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
    <NavigationProvider onNavigate={setView}>
      <VaultRedirect view={view} setView={setView} redirected={vaultRedirected} />
      <Layout activeView={view} onNavigate={setView}>
        {view === 'chat' && <ChatPanel />}
        {view === 'sources' && <SourcesPanel />}
        {view === 'notes' && <NotesPanel />}
        {view === 'graph' && <GraphPanel />}
        {view === 'settings' && <SettingsPanel />}
      </Layout>
    </NavigationProvider>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CollectionProvider>
          <ToastProvider>
            <AppShell />
          </ToastProvider>
        </CollectionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
