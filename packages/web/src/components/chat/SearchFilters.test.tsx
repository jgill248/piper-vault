import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SearchFilters, EMPTY_FILTERS } from './SearchFilters';
import type { SearchFilterState } from './SearchFilters';

vi.mock('../../hooks/use-sources', () => ({
  useListSources: () => ({
    data: {
      data: [
        { id: 'src-1', filename: 'notes.md' },
        { id: 'src-2', filename: 'report.pdf' },
      ],
    },
  }),
  useListTags: () => ({
    data: ['alpha', 'beta'],
  }),
}));

describe('SearchFilters', () => {
  afterEach(cleanup);

  it('renders collapsed by default', () => {
    render(<SearchFilters filters={EMPTY_FILTERS} onChange={vi.fn()} />);
    const toggle = screen.getByLabelText('Toggle search filters');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('expands when toggle is clicked', () => {
    render(<SearchFilters filters={EMPTY_FILTERS} onChange={vi.fn()} />);
    const toggle = screen.getByLabelText('Toggle search filters');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('SOURCES')).toBeDefined();
    expect(screen.getByText('FILE TYPES')).toBeDefined();
    expect(screen.getByText('TAGS')).toBeDefined();
  });

  it('shows active filter count badge', () => {
    const filters: SearchFilterState = {
      ...EMPTY_FILTERS,
      fileTypes: ['PDF'],
      tags: ['alpha'],
    };
    render(<SearchFilters filters={filters} onChange={vi.fn()} />);
    expect(screen.getByText('2 ACTIVE')).toBeDefined();
  });

  it('calls onChange when a file type is toggled', () => {
    const onChange = vi.fn();
    render(<SearchFilters filters={EMPTY_FILTERS} onChange={onChange} />);

    // Expand first
    fireEvent.click(screen.getByLabelText('Toggle search filters'));

    // Click PDF
    fireEvent.click(screen.getByText('PDF'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ fileTypes: ['PDF'] }),
    );
  });

  it('calls onChange when a tag is toggled', () => {
    const onChange = vi.fn();
    render(<SearchFilters filters={EMPTY_FILTERS} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Toggle search filters'));
    fireEvent.click(screen.getByText('alpha'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['alpha'] }),
    );
  });

  it('removes a file type when toggled off', () => {
    const onChange = vi.fn();
    const filters: SearchFilterState = { ...EMPTY_FILTERS, fileTypes: ['PDF'] };
    render(<SearchFilters filters={filters} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Toggle search filters'));
    fireEvent.click(screen.getByText('PDF'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ fileTypes: [] }),
    );
  });

  it('clears all filters when clear button is clicked', () => {
    const onChange = vi.fn();
    const filters: SearchFilterState = {
      ...EMPTY_FILTERS,
      fileTypes: ['PDF'],
      tags: ['alpha'],
    };
    render(<SearchFilters filters={filters} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Clear all filters'));
    expect(onChange).toHaveBeenCalledWith(EMPTY_FILTERS);
  });

  it('shows source checkboxes when expanded', () => {
    render(<SearchFilters filters={EMPTY_FILTERS} onChange={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Toggle search filters'));
    expect(screen.getByText('notes.md')).toBeDefined();
    expect(screen.getByText('report.pdf')).toBeDefined();
  });

  it('toggles a source filter', () => {
    const onChange = vi.fn();
    render(<SearchFilters filters={EMPTY_FILTERS} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Toggle search filters'));
    fireEvent.click(screen.getByText('notes.md'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ sourceIds: ['src-1'] }),
    );
  });
});
