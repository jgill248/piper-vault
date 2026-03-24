import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NoteEditor } from './NoteEditor';

// Mock ReactMarkdown to avoid parsing issues in test env
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown-preview">{children}</div>,
}));

function getTextarea(): HTMLTextAreaElement {
  return screen.getAllByPlaceholderText(/Start writing/)[0] as HTMLTextAreaElement;
}

describe('NoteEditor', () => {
  const defaultProps = {
    noteId: 'note-1',
    initialContent: 'Hello world',
    initialTitle: 'Test Note',
    onSave: vi.fn(),
    noteNames: ['PageA', 'PageB', 'OtherPage'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with initial title', () => {
    render(<NoteEditor {...defaultProps} />);
    const titleInput = screen.getAllByPlaceholderText('Note title...')[0] as HTMLInputElement;
    expect(titleInput.value).toBe('Test Note');
  });

  it('renders textarea with initial content', () => {
    render(<NoteEditor {...defaultProps} />);
    expect(getTextarea().value).toBe('Hello world');
  });

  it('marks content as dirty when textarea is edited', () => {
    render(<NoteEditor {...defaultProps} />);
    fireEvent.change(getTextarea(), { target: { value: 'new content' } });
    expect(screen.getAllByText('unsaved').length).toBeGreaterThan(0);
  });

  it('switches to preview mode', () => {
    render(<NoteEditor {...defaultProps} />);
    const previewBtns = screen.getAllByTitle('Preview');
    fireEvent.click(previewBtns[0]!);
    expect(screen.getAllByTestId('markdown-preview').length).toBeGreaterThan(0);
  });

  it('calls onSave when manual save is clicked', () => {
    const onSave = vi.fn();
    render(<NoteEditor {...defaultProps} onSave={onSave} />);
    const saveBtns = screen.getAllByTitle('Save');
    // Click the last Save button (the most recent render)
    fireEvent.click(saveBtns[saveBtns.length - 1]!);
    expect(onSave).toHaveBeenCalledWith('Hello world', 'Test Note');
  });

  it('shows autocomplete when [[ is typed', () => {
    render(<NoteEditor {...defaultProps} />);
    const textarea = getTextarea();

    Object.defineProperty(textarea, 'selectionStart', { value: 8, writable: true });
    fireEvent.change(textarea, {
      target: { value: 'See [[Pa', selectionStart: 8 },
    });

    expect(screen.getAllByText('PageA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PageB').length).toBeGreaterThan(0);
  });
});
