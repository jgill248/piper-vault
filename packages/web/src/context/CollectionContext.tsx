/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DEFAULT_COLLECTION_ID } from '@delve/shared';

const STORAGE_KEY = 'delve:activeCollectionId';

interface CollectionContextValue {
  readonly activeCollectionId: string;
  readonly setActiveCollectionId: (id: string) => void;
}

const CollectionContext = createContext<CollectionContextValue | null>(null);

function readStoredId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_COLLECTION_ID;
  } catch {
    return DEFAULT_COLLECTION_ID;
  }
}

interface CollectionProviderProps {
  children: ReactNode;
}

export function CollectionProvider({ children }: CollectionProviderProps) {
  const [activeCollectionId, setActiveCollectionIdState] = useState<string>(readStoredId);

  const setActiveCollectionId = useCallback((id: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore storage errors
    }
    setActiveCollectionIdState(id);
  }, []);

  const value = useMemo(
    () => ({ activeCollectionId, setActiveCollectionId }),
    [activeCollectionId, setActiveCollectionId],
  );

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

export function useActiveCollection(): CollectionContextValue {
  const ctx = useContext(CollectionContext);
  if (!ctx) {
    throw new Error('useActiveCollection must be used within a CollectionProvider');
  }
  return ctx;
}
