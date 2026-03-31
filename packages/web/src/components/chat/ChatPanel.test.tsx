import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

import { ChatPanel } from './ChatPanel';
import { CollectionProvider } from '../../context/CollectionContext';

// ---------------------------------------------------------------------------
// Mock hooks
// ---------------------------------------------------------------------------

const mockExportMutate = vi.fn();
const mockDeleteMutate = vi.fn();

let mockPersistedId: string | undefined = undefined;
const mockSetPersistedId = vi.fn((val: string | undefined) => {
  mockPersistedId = val;
});

vi.mock('../../hooks/use-persisted-conversation', () => ({
  usePersistedConversationId: () => [mockPersistedId, mockSetPersistedId] as const,
}));

vi.mock('../../hooks/use-chat', () => ({
  useConversations: () => ({ data: [] }),
  useConversation: () => ({ data: undefined, isError: false }),
  useExportConversation: () => ({
    mutate: mockExportMutate,
    isPending: false,
  }),
  useDeleteConversation: () => ({
    mutate: mockDeleteMutate,
    isPending: false,
  }),
}));

vi.mock('../../api/client', () => ({
  api: {
    sendMessageStream: vi.fn(),
  },
}));

vi.mock('../../hooks/use-sources', () => ({
  useListSources: () => ({ data: { data: [], total: 0 } }),
  useListTags: () => ({ data: [] }),
}));

vi.mock('../../hooks/use-vault-status', () => ({
  useVaultStatus: () => ({ isEmpty: false, isLoading: false }),
}));

vi.mock('../../context/NavigationContext', () => ({
  useNavigation: () => ({
    navigate: vi.fn(),
    navigateToNote: vi.fn(),
    pendingNoteId: undefined,
    clearPendingNote: vi.fn(),
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(CollectionProvider, null, children),
    );
  };
}

describe('ChatPanel', () => {
  afterEach(() => {
    cleanup();
    mockPersistedId = undefined;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPersistedId = undefined;
  });

  it('renders empty state when no messages exist', () => {
    render(<ChatPanel />, { wrapper: createWrapper() });
    expect(screen.getByText('No active session')).toBeDefined();
  });

  it('renders history toggle button', () => {
    render(<ChatPanel />, { wrapper: createWrapper() });
    const btn = screen.getByLabelText('Toggle conversation history');
    expect(btn).toBeDefined();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows search filters section', () => {
    render(<ChatPanel />, { wrapper: createWrapper() });
    expect(screen.getByLabelText('Toggle search filters')).toBeDefined();
  });

  it('renders ChatInput for message entry', () => {
    render(<ChatPanel />, { wrapper: createWrapper() });
    expect(screen.getByPlaceholderText('Enter query...')).toBeDefined();
  });

  it('does not show delete button when no conversation is active', () => {
    render(<ChatPanel />, { wrapper: createWrapper() });
    expect(screen.queryByLabelText('Delete conversation')).toBeNull();
  });

  it('does not show export button when no conversation is active', () => {
    render(<ChatPanel />, { wrapper: createWrapper() });
    expect(screen.queryByLabelText('Export conversation as markdown')).toBeNull();
  });
});

describe('ChatPanel with active conversation', () => {
  afterEach(() => {
    cleanup();
    mockPersistedId = undefined;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPersistedId = 'abc12345-0000-0000-0000-000000000000';
  });

  it('shows delete button when conversation is active', () => {
    render(<ChatPanel />, { wrapper: createWrapper() });
    expect(screen.getByLabelText('Delete conversation')).toBeDefined();
  });

  it('shows export button when conversation is active', () => {
    render(<ChatPanel />, { wrapper: createWrapper() });
    expect(screen.getByLabelText('Export conversation as markdown')).toBeDefined();
  });

  it('shows Y/N confirmation on delete click', () => {
    render(<ChatPanel />, { wrapper: createWrapper() });
    const deleteBtn = screen.getByLabelText('Delete conversation');
    fireEvent.click(deleteBtn);

    expect(screen.getByText('DELETE?')).toBeDefined();
    expect(screen.getByLabelText('Confirm delete conversation')).toBeDefined();
    expect(screen.getByLabelText('Cancel delete')).toBeDefined();
  });

  it('cancels delete confirmation on N click', () => {
    render(<ChatPanel />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByLabelText('Delete conversation'));

    // Confirmation is shown
    expect(screen.getByText('DELETE?')).toBeDefined();

    // Click cancel
    fireEvent.click(screen.getByLabelText('Cancel delete'));

    // Confirmation is gone, delete button is back
    expect(screen.queryByText('DELETE?')).toBeNull();
    expect(screen.getByLabelText('Delete conversation')).toBeDefined();
  });

  it('calls deleteConversation.mutate on Y confirm', () => {
    render(<ChatPanel />, { wrapper: createWrapper() });

    // First click shows confirmation
    fireEvent.click(screen.getByLabelText('Delete conversation'));
    // Second click (Y) triggers mutation
    fireEvent.click(screen.getByLabelText('Confirm delete conversation'));

    expect(mockDeleteMutate).toHaveBeenCalledWith(
      'abc12345-0000-0000-0000-000000000000',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('shows session ID in header', () => {
    render(<ChatPanel />, { wrapper: createWrapper() });
    expect(screen.getByText('SESSION: abc12345')).toBeDefined();
  });
});

describe('ChatPanel follow-up suggestions', () => {
  afterEach(() => {
    cleanup();
    mockPersistedId = undefined;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPersistedId = undefined;
  });

  it('adds optimistic user message on submit', async () => {
    const { api } = await import('../../api/client');
    // Mock the stream to yield nothing (just resolve)
    (api.sendMessageStream as ReturnType<typeof vi.fn>).mockImplementation(async function* () {
      yield { type: 'meta', conversationId: 'test-conv', messageId: 'test-msg' };
      yield { type: 'done' };
    });

    render(<ChatPanel />, { wrapper: createWrapper() });

    const textarea = screen.getByPlaceholderText('Enter query...');
    fireEvent.change(textarea, { target: { value: 'test query' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(api.sendMessageStream).toHaveBeenCalled();
  });
});
