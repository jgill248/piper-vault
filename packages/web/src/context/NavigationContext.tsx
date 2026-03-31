import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type View = 'chat' | 'sources' | 'settings' | 'notes' | 'graph';

interface NavigationContextValue {
  navigate: (view: View) => void;
  navigateToNote: (noteId: string) => void;
  pendingNoteId: string | undefined;
  clearPendingNote: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

interface NavigationProviderProps {
  onNavigate: (view: View) => void;
  children: ReactNode;
}

export function NavigationProvider({ onNavigate, children }: NavigationProviderProps) {
  const [pendingNoteId, setPendingNoteId] = useState<string | undefined>();

  const navigate = useCallback(
    (view: View) => onNavigate(view),
    [onNavigate],
  );

  const navigateToNote = useCallback(
    (noteId: string) => {
      setPendingNoteId(noteId);
      onNavigate('notes');
    },
    [onNavigate],
  );

  const clearPendingNote = useCallback(() => setPendingNoteId(undefined), []);

  return (
    <NavigationContext.Provider value={{ navigate, navigateToNote, pendingNoteId, clearPendingNote }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider');
  return ctx;
}
