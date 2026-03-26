import { useState, useCallback } from 'react';

const STORAGE_KEY = 'delve:activeConversationId';

function readStoredId(): string | undefined {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function usePersistedConversationId() {
  const [id, setIdState] = useState<string | undefined>(readStoredId);

  const setId = useCallback((newId: string | undefined) => {
    try {
      if (newId) {
        localStorage.setItem(STORAGE_KEY, newId);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
    setIdState(newId);
  }, []);

  return [id, setId] as const;
}
