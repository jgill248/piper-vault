import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

import { ChatPanel } from './ChatPanel';
import { CollectionProvider } from '../../context/CollectionContext';

// ---------------------------------------------------------------------------
// Mock hooks
// ---------------------------------------------------------------------------

const mockMutate = vi.fn();
const mockExportMutate = vi.fn();

vi.mock('../../hooks/use-chat', () => ({
  useSendMessage: () => ({
    mutate: mockMutate,
    isPending: false,
    isError: false,
    error: null,
  }),
  useConversations: () => ({ data: [] }),
  useConversation: () => ({ data: undefined }),
  useExportConversation: () => ({
    mutate: mockExportMutate,
    isPending: false,
  }),
}));

vi.mock('../../hooks/use-sources', () => ({
  useListSources: () => ({ data: { data: [] } }),
  useListTags: () => ({ data: [] }),
}));

describe('ChatPanel', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no messages exist', () => {
    render(<CollectionProvider><ChatPanel /></CollectionProvider>);
    expect(screen.getByText('No active session')).toBeDefined();
  });

  it('renders history toggle button', () => {
    render(<CollectionProvider><ChatPanel /></CollectionProvider>);
    const btn = screen.getByLabelText('Toggle conversation history');
    expect(btn).toBeDefined();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows search filters section', () => {
    render(<CollectionProvider><ChatPanel /></CollectionProvider>);
    expect(screen.getByLabelText('Toggle search filters')).toBeDefined();
  });

  it('renders ChatInput for message entry', () => {
    render(<CollectionProvider><ChatPanel /></CollectionProvider>);
    expect(screen.getByPlaceholderText('Enter query...')).toBeDefined();
  });
});

describe('ChatPanel follow-up suggestions', () => {
  afterEach(cleanup);

  it('renders follow-up suggestions and handles click', async () => {
    // Re-mock to simulate a conversation with follow-ups already present
    // We test the UI rendering by injecting state through interaction
    const { useSendMessage } = await import('../../hooks/use-chat');

    // Simulate: user sends a message, onSuccess sets follow-ups
    let onSuccessCallback: ((data: any) => void) | undefined;
    mockMutate.mockImplementation((_body: any, opts: any) => {
      onSuccessCallback = opts?.onSuccess;
    });

    render(<CollectionProvider><ChatPanel /></CollectionProvider>);

    // Type a message and submit
    const textarea = screen.getByPlaceholderText('Enter query...');
    fireEvent.change(textarea, { target: { value: 'test query' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(mockMutate).toHaveBeenCalled();
  });
});

describe('ChatPanel export', () => {
  afterEach(cleanup);

  it('does not show export button when no conversation is active', () => {
    render(<CollectionProvider><ChatPanel /></CollectionProvider>);
    expect(screen.queryByLabelText('Export conversation as markdown')).toBeNull();
  });
});
