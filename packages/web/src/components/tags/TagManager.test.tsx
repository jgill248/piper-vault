import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TagManager } from './TagManager';

// Mock useNotes hook
vi.mock('../../hooks/use-notes', () => ({
  useNotes: () => ({
    data: {
      data: [
        { id: '1', tags: ['react', 'frontend'], title: 'Note 1' },
        { id: '2', tags: ['react', 'typescript'], title: 'Note 2' },
        { id: '3', tags: ['backend', 'api'], title: 'Note 3' },
      ],
    },
  }),
  useUpdateNote: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
  }),
}));

// Mock useActiveCollection
vi.mock('../../context/CollectionContext', () => ({
  useActiveCollection: () => ({ activeCollectionId: 'col-1' }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('TagManager', () => {
  it('renders all tags as buttons', () => {
    const onFilter = vi.fn();
    renderWithProviders(<TagManager onFilterByTag={onFilter} />);
    const buttons = screen.getAllByRole('button');
    // 5 tag buttons + 1 "Bulk Edit" button
    expect(buttons.length).toBe(6);
  });

  it('renders tag labels with # prefix', () => {
    const onFilter = vi.fn();
    const { container } = renderWithProviders(<TagManager onFilterByTag={onFilter} />);
    const buttonTexts = Array.from(container.querySelectorAll('button')).map(
      (b) => b.textContent,
    );
    expect(buttonTexts.some((t) => t?.includes('#react'))).toBe(true);
    expect(buttonTexts.some((t) => t?.includes('#frontend'))).toBe(true);
  });

  it('displays tag counts', () => {
    const onFilter = vi.fn();
    const { container } = renderWithProviders(<TagManager onFilterByTag={onFilter} />);
    // react appears in 2 notes — its count badge should show "2"
    const buttons = Array.from(container.querySelectorAll('button'));
    const reactBtn = buttons.find((b) => b.textContent?.includes('#react'));
    expect(reactBtn?.textContent).toContain('2');
  });
});
