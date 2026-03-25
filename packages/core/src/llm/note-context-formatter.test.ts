import { describe, it, expect } from 'vitest';
import { formatNoteContext, type NoteMetadata } from './note-context-formatter.js';

function makeNote(overrides: Partial<NoteMetadata> = {}): NoteMetadata {
  return {
    id: 'note-1',
    title: 'Test Note',
    filename: 'test-note.md',
    tags: [],
    content: 'Some content here.',
    createdAt: new Date('2026-03-25T10:00:00Z'),
    updatedAt: new Date('2026-03-25T10:00:00Z'),
    parentPath: null,
    ...overrides,
  };
}

describe('formatNoteContext', () => {
  it('returns "no notes found" when array is empty', () => {
    const result = formatNoteContext([], 'today');
    expect(result).toContain('No notes were found for today');
    expect(result).toContain('--- Notes from today ---');
    expect(result).toContain('--- End of Notes ---');
  });

  it('formats a single note with title and content', () => {
    const notes = [makeNote({ title: 'My First Note', content: 'Hello world' })];
    const result = formatNoteContext(notes, 'today');
    expect(result).toContain('Found 1 note from today');
    expect(result).toContain('"My First Note"');
    expect(result).toContain('Hello world');
  });

  it('formats multiple notes', () => {
    const notes = [
      makeNote({ id: '1', title: 'Note A' }),
      makeNote({ id: '2', title: 'Note B' }),
      makeNote({ id: '3', title: 'Note C' }),
    ];
    const result = formatNoteContext(notes, 'this week');
    expect(result).toContain('Found 3 notes from this week');
    expect(result).toContain('1. "Note A"');
    expect(result).toContain('2. "Note B"');
    expect(result).toContain('3. "Note C"');
  });

  it('includes tags when present', () => {
    const notes = [makeNote({ tags: ['api', 'design'] })];
    const result = formatNoteContext(notes, 'today');
    expect(result).toContain('#api');
    expect(result).toContain('#design');
  });

  it('includes folder path when present', () => {
    const notes = [makeNote({ parentPath: 'projects/delve' })];
    const result = formatNoteContext(notes, 'today');
    expect(result).toContain('Folder: projects/delve');
  });

  it('truncates long content preview', () => {
    const longContent = 'x'.repeat(300);
    const notes = [makeNote({ content: longContent })];
    const result = formatNoteContext(notes, 'today');
    expect(result).toContain('...');
    // Should not contain the full 300-char string
    expect(result).not.toContain(longContent);
  });

  it('shows "(empty note)" for null content', () => {
    const notes = [makeNote({ content: null })];
    const result = formatNoteContext(notes, 'today');
    expect(result).toContain('(empty note)');
  });

  it('falls back to filename when title is null', () => {
    const notes = [makeNote({ title: null, filename: 'fallback.md' })];
    const result = formatNoteContext(notes, 'today');
    expect(result).toContain('"fallback.md"');
  });

  it('uses the provided dateLabel', () => {
    const result = formatNoteContext([], 'yesterday');
    expect(result).toContain('--- Notes from yesterday ---');
    expect(result).toContain('No notes were found for yesterday');
  });
});
