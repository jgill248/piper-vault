import { describe, it, expect } from 'vitest';
import type { ConversationWithMessages, Message } from '@delve/shared';
import { exportConversationAsMarkdown } from './markdown-exporter.js';

function makeConversation(
  overrides: Partial<ConversationWithMessages> = {},
): ConversationWithMessages {
  return {
    id: 'conv-1',
    title: 'Test Conversation',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    messages: [],
    ...overrides,
  };
}

function makeUserMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    role: 'user',
    content: 'What is the capital of France?',
    createdAt: new Date('2026-01-01T10:00:00Z'),
    ...overrides,
  };
}

function makeAssistantMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-2',
    conversationId: 'conv-1',
    role: 'assistant',
    content: 'The capital of France is Paris.',
    createdAt: new Date('2026-01-01T10:00:05Z'),
    ...overrides,
  };
}

describe('exportConversationAsMarkdown', () => {
  it('exports the conversation title as an h1 heading', () => {
    const conversation = makeConversation({ title: 'My Knowledge Session' });
    const result = exportConversationAsMarkdown(conversation);
    expect(result).toContain('# My Knowledge Session');
  });

  it('includes the export date', () => {
    const conversation = makeConversation();
    const result = exportConversationAsMarkdown(conversation);
    // Matches YYYY-MM-DD format
    expect(result).toMatch(/\*Exported on \d{4}-\d{2}-\d{2}\*/);
  });

  it('formats user messages with ## User heading', () => {
    const conversation = makeConversation({ messages: [makeUserMessage()] });
    const result = exportConversationAsMarkdown(conversation);
    expect(result).toContain('## User');
    expect(result).toContain('What is the capital of France?');
  });

  it('formats assistant messages with ## Assistant heading', () => {
    const conversation = makeConversation({ messages: [makeAssistantMessage()] });
    const result = exportConversationAsMarkdown(conversation);
    expect(result).toContain('## Assistant');
    expect(result).toContain('The capital of France is Paris.');
  });

  it('formats system messages with ## System heading', () => {
    const systemMsg: Message = {
      id: 'msg-sys',
      conversationId: 'conv-1',
      role: 'system',
      content: 'System context loaded.',
      createdAt: new Date('2026-01-01T09:00:00Z'),
    };
    const conversation = makeConversation({ messages: [systemMsg] });
    const result = exportConversationAsMarkdown(conversation);
    expect(result).toContain('## System');
  });

  it('includes source citations when sources are present', () => {
    const msgWithSources = makeAssistantMessage({
      sources: ['notes.md', 'research.pdf'],
    });
    const conversation = makeConversation({ messages: [msgWithSources] });
    const result = exportConversationAsMarkdown(conversation);
    expect(result).toContain('> Sources: notes.md, research.pdf');
  });

  it('does not include sources line when sources array is empty', () => {
    const msgNoSources = makeAssistantMessage({ sources: [] });
    const conversation = makeConversation({ messages: [msgNoSources] });
    const result = exportConversationAsMarkdown(conversation);
    expect(result).not.toContain('> Sources:');
  });

  it('includes model info when model is present', () => {
    const msgWithModel = makeAssistantMessage({ model: 'claude-3.5-sonnet' });
    const conversation = makeConversation({ messages: [msgWithModel] });
    const result = exportConversationAsMarkdown(conversation);
    expect(result).toContain('> Model: claude-3.5-sonnet');
  });

  it('does not include model line when model is absent', () => {
    const msgNoModel = makeUserMessage();
    const conversation = makeConversation({ messages: [msgNoModel] });
    const result = exportConversationAsMarkdown(conversation);
    expect(result).not.toContain('> Model:');
  });

  it('handles empty messages array without throwing', () => {
    const conversation = makeConversation({ messages: [] });
    const result = exportConversationAsMarkdown(conversation);
    expect(result).toContain('# Test Conversation');
    expect(result).not.toContain('## User');
    expect(result).not.toContain('## Assistant');
  });

  it('includes a horizontal rule separator between sections', () => {
    const conversation = makeConversation({ messages: [makeUserMessage(), makeAssistantMessage()] });
    const result = exportConversationAsMarkdown(conversation);
    // Should have multiple --- separators
    const separators = result.match(/^---$/gm);
    expect(separators).not.toBeNull();
    expect((separators ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('includes the message timestamp in ISO format', () => {
    const createdAt = new Date('2026-03-15T14:30:00Z');
    const conversation = makeConversation({ messages: [makeUserMessage({ createdAt })] });
    const result = exportConversationAsMarkdown(conversation);
    expect(result).toContain('2026-03-15T14:30:00.000Z');
  });

  it('handles createdAt as a non-Date value by converting it', () => {
    // Some DB drivers may return timestamps as strings
    const createdAt = '2026-03-15T14:30:00Z' as unknown as Date;
    const conversation = makeConversation({ messages: [makeUserMessage({ createdAt })] });
    const result = exportConversationAsMarkdown(conversation);
    expect(result).toContain('2026-03-15');
  });
});
