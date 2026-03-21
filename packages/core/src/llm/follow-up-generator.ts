import type { LlmProvider } from './provider.js';
import type { ChunkSearchResult } from '@delve/shared';

/**
 * Generates follow-up questions based on the conversation context.
 * Returns an empty array on failure (graceful degradation).
 */
export async function generateFollowUpQuestions(
  llm: LlmProvider,
  userQuery: string,
  assistantResponse: string,
  context: readonly ChunkSearchResult[],
  count = 3,
): Promise<string[]> {
  const sourceNames = [...new Set(context.map(c => c.source.filename))].join(', ');

  const prompt = `Based on this conversation exchange and the available source documents, suggest exactly ${count} concise follow-up questions the user might want to ask next. Each question should explore a different angle or dig deeper into the topic.

User asked: "${userQuery}"

Assistant answered: "${assistantResponse.slice(0, 500)}"

${sourceNames ? `Available sources: ${sourceNames}` : ''}

Respond with ONLY a JSON array of ${count} question strings. Example: ["Question 1?", "Question 2?", "Question 3?"]`;

  const result = await llm.query({
    prompt,
    systemPrompt: 'You generate follow-up questions. Output only a JSON array of strings.',
    maxTokens: 300,
  });

  if (!result.ok) return [];

  try {
    const content = result.value.content.trim();
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((q): q is string => typeof q === 'string').slice(0, count);
  } catch {
    return [];
  }
}
