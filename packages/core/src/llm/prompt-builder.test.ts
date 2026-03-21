import { describe, it, expect } from 'vitest';
import type { ChunkSearchResult, Message } from '@delve/shared';
import { MESSAGE_ROLE } from '@delve/shared';
import { buildPrompt } from './prompt-builder.js';

function makeChunkResult(filename: string, content: string, chunkIndex = 0): ChunkSearchResult {
  return {
    source: { id: '1', filename, fileType: 'text/plain' },
    chunk: { id: '1', sourceId: '1', chunkIndex, content, tokenCount: 10, metadata: {}, createdAt: new Date() },
    score: 0.9,
  };
}

function makeMessage(role: 'user' | 'assistant', content: string): Message {
  return { id: '1', conversationId: '1', role: role === 'user' ? MESSAGE_ROLE.USER : MESSAGE_ROLE.ASSISTANT, content, createdAt: new Date() };
}

describe('buildPrompt', () => {
  it('includes system prompt', () => {
    const { systemPrompt } = buildPrompt('Hello', [], [], 5);
    expect(systemPrompt).toContain('knowledge base');
    expect(systemPrompt).toContain('Cite your sources');
  });

  it('includes context blocks with source labels', () => {
    const context = [makeChunkResult('notes.md', 'Some content about testing')];
    const { prompt } = buildPrompt('What about testing?', context, [], 5);
    expect(prompt).toContain('[Source 1: notes.md, chunk 1]');
    expect(prompt).toContain('Some content about testing');
    expect(prompt).toContain('Question: What about testing?');
  });

  it('shows no-context message when context is empty', () => {
    const { prompt } = buildPrompt('Random question', [], [], 5);
    expect(prompt).toContain('No relevant context was found');
  });

  it('includes conversation history', () => {
    const history = [
      makeMessage('user', 'First question'),
      makeMessage('assistant', 'First answer'),
    ];
    const { prompt } = buildPrompt('Follow up', [], history, 5);
    expect(prompt).toContain('User: First question');
    expect(prompt).toContain('Assistant: First answer');
  });

  it('limits history to maxHistoryTurns', () => {
    const history = [
      makeMessage('user', 'Old question'),
      makeMessage('assistant', 'Old answer'),
      makeMessage('user', 'Recent question'),
      makeMessage('assistant', 'Recent answer'),
    ];
    const { prompt } = buildPrompt('New question', [], history, 1);
    expect(prompt).not.toContain('Old question');
    expect(prompt).toContain('Recent question');
  });

  it('handles zero maxHistoryTurns', () => {
    const history = [makeMessage('user', 'OldUserMsg'), makeMessage('assistant', 'OldAssistantMsg')];
    const { prompt } = buildPrompt('New', [], history, 0);
    expect(prompt).not.toContain('OldUserMsg');
    expect(prompt).not.toContain('OldAssistantMsg');
    expect(prompt).not.toContain('Conversation History');
  });
});
