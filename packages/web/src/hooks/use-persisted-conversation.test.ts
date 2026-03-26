import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { usePersistedConversationId } from './use-persisted-conversation';

const STORAGE_KEY = 'delve:activeConversationId';

describe('usePersistedConversationId', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(cleanup);

  it('returns undefined when nothing is stored', () => {
    const { result } = renderHook(() => usePersistedConversationId());
    expect(result.current[0]).toBeUndefined();
  });

  it('reads stored ID from localStorage on init', () => {
    localStorage.setItem(STORAGE_KEY, 'conv-123');
    const { result } = renderHook(() => usePersistedConversationId());
    expect(result.current[0]).toBe('conv-123');
  });

  it('writes to localStorage when setting a value', () => {
    const { result } = renderHook(() => usePersistedConversationId());

    act(() => {
      result.current[1]('conv-456');
    });

    expect(result.current[0]).toBe('conv-456');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('conv-456');
  });

  it('removes from localStorage when setting undefined', () => {
    localStorage.setItem(STORAGE_KEY, 'conv-789');
    const { result } = renderHook(() => usePersistedConversationId());

    act(() => {
      result.current[1](undefined);
    });

    expect(result.current[0]).toBeUndefined();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('handles localStorage.getItem errors gracefully', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage error');
    });

    const { result } = renderHook(() => usePersistedConversationId());
    expect(result.current[0]).toBeUndefined();
  });

  it('handles localStorage.setItem errors gracefully', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage error');
    });

    const { result } = renderHook(() => usePersistedConversationId());

    // Should not throw, just silently fail the write
    act(() => {
      result.current[1]('conv-err');
    });

    // State still updates even if storage fails
    expect(result.current[0]).toBe('conv-err');
  });

  it('setter is stable across renders', () => {
    const { result, rerender } = renderHook(() => usePersistedConversationId());
    const firstSetter = result.current[1];
    rerender();
    expect(result.current[1]).toBe(firstSetter);
  });
});
