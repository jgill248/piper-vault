import { describe, it, expect } from 'vitest';
import { JsonParser } from './json-parser.js';

const parser = new JsonParser();

describe('JsonParser', () => {
  it('supports application/json', () => {
    expect(parser.supportedTypes).toContain('application/json');
  });

  it('flattens a simple object', async () => {
    const json = JSON.stringify({ name: 'Alice', age: 30 });
    const result = await parser.parse(Buffer.from(json), 'data.json');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.text).toContain('name: Alice');
      expect(result.value.text).toContain('age: 30');
      expect(result.value.metadata['topLevelType']).toBe('object');
    }
  });

  it('flattens nested objects with dot notation', async () => {
    const json = JSON.stringify({ user: { name: 'Bob', address: { city: 'NYC' } } });
    const result = await parser.parse(Buffer.from(json), 'nested.json');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.text).toContain('user.name: Bob');
      expect(result.value.text).toContain('user.address.city: NYC');
    }
  });

  it('flattens arrays with bracket notation', async () => {
    const json = JSON.stringify([{ id: 1 }, { id: 2 }]);
    const result = await parser.parse(Buffer.from(json), 'arr.json');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.text).toContain('[0].id: 1');
      expect(result.value.text).toContain('[1].id: 2');
      expect(result.value.metadata['topLevelType']).toBe('array');
      expect(result.value.metadata['itemCount']).toBe(2);
    }
  });

  it('returns error for invalid JSON', async () => {
    const result = await parser.parse(Buffer.from('{invalid'), 'bad.json');
    expect(result.ok).toBe(false);
  });

  it('returns error for empty file', async () => {
    const result = await parser.parse(Buffer.from(''), 'empty.json');
    expect(result.ok).toBe(false);
  });
});
