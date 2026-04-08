import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NoteEditor } from './NoteEditor';

// Mock ReactMarkdown and remark plugins to avoid parsing issues in test env
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown-preview">{children}</div>,
}));

vi.mock('remark-gfm', () => ({ default: () => {} }));

vi.mock('./remark-wiki-links', () => ({ remarkWikiLinks: () => {} }));

vi.mock('./WikiLink', () => ({
  WikiLink: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

/**
 * The NoteEditor defaults to preview mode. Many tests need edit mode,
 * so this helper clicks the "Edit" toggle button first.
 */
function switchToEditMode() {
  const editBtns = screen.getAllByTitle('Edit');
  fireEvent.click(editBtns[0]!);
}

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

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with initial title', () => {
    render(<NoteEditor {...defaultProps} />);
    const titleInput = screen.getAllByPlaceholderText('Note title...')[0] as HTMLInputElement;
    expect(titleInput.value).toBe('Test Note');
  });

  it('starts in preview mode by default', () => {
    render(<NoteEditor {...defaultProps} />);
    expect(screen.getAllByTestId('markdown-preview').length).toBeGreaterThan(0);
  });

  it('renders textarea with initial content in edit mode', () => {
    render(<NoteEditor {...defaultProps} />);
    switchToEditMode();
    expect(getTextarea().value).toBe('Hello world');
  });

  it('marks content as dirty when textarea is edited', () => {
    render(<NoteEditor {...defaultProps} />);
    switchToEditMode();
    fireEvent.change(getTextarea(), { target: { value: 'new content' } });
    expect(screen.getAllByText('unsaved').length).toBeGreaterThan(0);
  });

  it('switches between edit and preview mode', () => {
    render(<NoteEditor {...defaultProps} />);
    // Starts in preview — no textarea visible
    expect(screen.queryByPlaceholderText(/Start writing/)).toBeNull();
    // Switch to edit — textarea appears
    switchToEditMode();
    expect(screen.getByPlaceholderText(/Start writing/)).toBeDefined();
    // Switch back to preview — textarea gone, markdown visible
    const previewBtns = screen.getAllByTitle('Preview');
    fireEvent.click(previewBtns[0]!);
    expect(screen.queryByPlaceholderText(/Start writing/)).toBeNull();
    expect(screen.getAllByTestId('markdown-preview').length).toBeGreaterThan(0);
  });

  it('calls onSave when manual save is clicked', () => {
    const onSave = vi.fn();
    render(<NoteEditor {...defaultProps} onSave={onSave} />);
    const saveBtns = screen.getAllByTitle('Save');
    fireEvent.click(saveBtns[saveBtns.length - 1]!);
    expect(onSave).toHaveBeenCalledWith('Hello world', 'Test Note');
  });

  it('shows autocomplete when [[ is typed', () => {
    render(<NoteEditor {...defaultProps} />);
    switchToEditMode();
    const textarea = getTextarea();

    Object.defineProperty(textarea, 'selectionStart', { value: 8, writable: true });
    fireEvent.change(textarea, {
      target: { value: 'See [[Pa', selectionStart: 8 },
    });

    expect(screen.getAllByText('PageA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PageB').length).toBeGreaterThan(0);
  });
});
