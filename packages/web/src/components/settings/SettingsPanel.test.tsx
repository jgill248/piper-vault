import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ToastProvider } from '../../context/ToastContext';

function renderWithProviders(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

// ---------------------------------------------------------------------------
// Mock hooks — factories must not reference top-level variables (hoisted)
// ---------------------------------------------------------------------------

const mockMutate = vi.fn();

vi.mock('../../hooks/use-config', () => {
  // IMPORTANT: must be a stable reference — returning a new object each render
  // would cause useEffect([config]) to loop infinitely.
  const stableConfig = Object.freeze({
    llmModel: 'gpt-4',
    llmProvider: 'ask-sage',
    embeddingModel: 'all-MiniLM-L6-v2',
    chunkSize: 512,
    chunkOverlap: 64,
    topKResults: 8,
    similarityThreshold: 0.72,
    maxContextTokens: 4000,
    maxConversationTurns: 10,
    hybridSearchEnabled: false,
    hybridSearchWeight: 0.5,
    rerankEnabled: false,
    rerankStrategy: 'none',
    rerankTopN: 5,
    followUpQuestionsEnabled: true,
    pluginsDir: '',
  });
  return {
    useConfig: () => ({
      data: stableConfig,
      isLoading: false,
      isError: false,
    }),
    useUpdateConfig: () => ({
      mutate: (...args: unknown[]) => ((globalThis as Record<string, unknown>).__mockMutate as ((...a: unknown[]) => unknown) | undefined)?.(...args),
      isPending: false,
    }),
    useModels: () => ({
      data: { models: ['gpt-4', 'gpt-4-turbo', 'claude-3-opus'] },
      isLoading: false,
      isError: false,
    }),
  };
});

vi.mock('../../hooks/use-theme', () => ({
  useTheme: () => ({
    theme: 'dark' as const,
    toggle: vi.fn(),
    setTheme: vi.fn(),
  }),
}));

vi.mock('../../hooks/use-plugins', () => ({
  usePlugins: () => ({
    data: [],
    isLoading: false,
    isError: false,
  }),
  useReloadPlugins: () => ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
  }),
}));

vi.mock('../../hooks/use-api-keys', () => ({
  useApiKeys: () => ({ data: [], isLoading: false }),
  useCreateApiKey: () => ({ mutate: vi.fn(), isPending: false }),
  useRevokeApiKey: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/use-watched-folders', () => ({
  useWatchedFolders: () => ({ data: [], isLoading: false }),
  useAddWatchedFolder: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveWatchedFolder: () => ({ mutate: vi.fn(), isPending: false }),
  useScanWatchedFolder: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/use-collections', () => ({
  useCollections: () => ({ data: { data: [] }, isLoading: false }),
}));

vi.mock('../../hooks/use-provider-settings', () => ({
  useProviderSettings: () => ({ data: [], isLoading: false }),
  useUpdateProviderSettings: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/use-presets', () => ({
  usePresets: () => ({ data: [], isLoading: false }),
  useCreatePreset: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdatePreset: () => ({ mutate: vi.fn(), isPending: false }),
  useDeletePreset: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { SettingsPanel } from './SettingsPanel';

// Wire up mockMutate via globalThis to avoid hoisting issue
(globalThis as Record<string, unknown>).__mockMutate = mockMutate;

describe('SettingsPanel', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the settings header', () => {
    renderWithProviders(<SettingsPanel />);
    expect(screen.getByText('System Configuration')).toBeDefined();
  });

  it('renders LLM provider dropdown with all options', () => {
    renderWithProviders(<SettingsPanel />);
    // ASK_SAGE appears in both config editor and system info, so use getAllByText
    expect(screen.getAllByText('ASK_SAGE').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ANTHROPIC').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('OPENAI').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('OLLAMA').length).toBeGreaterThanOrEqual(1);
  });

  it('renders hybrid search toggle', () => {
    renderWithProviders(<SettingsPanel />);
    expect(screen.getByLabelText('Toggle hybrid search')).toBeDefined();
  });

  it('renders re-ranking toggle', () => {
    renderWithProviders(<SettingsPanel />);
    expect(screen.getByLabelText('Toggle re-ranking')).toBeDefined();
  });

  it('renders follow-up questions toggle', () => {
    renderWithProviders(<SettingsPanel />);
    expect(screen.getByLabelText('Toggle follow-up questions')).toBeDefined();
  });

  it('save button is disabled when no changes are made', () => {
    renderWithProviders(<SettingsPanel />);
    const saveBtn = screen.getByLabelText('Save configuration changes');
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables save button after a change is made', () => {
    renderWithProviders(<SettingsPanel />);
    fireEvent.click(screen.getByLabelText('Toggle hybrid search'));
    const saveBtn = screen.getByLabelText('Save configuration changes');
    expect((saveBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows HYBRID_WEIGHT slider when hybrid search is enabled', () => {
    renderWithProviders(<SettingsPanel />);
    expect(screen.queryByText('HYBRID_WEIGHT')).toBeNull();
    fireEvent.click(screen.getByLabelText('Toggle hybrid search'));
    expect(screen.getByText('HYBRID_WEIGHT')).toBeDefined();
  });

  it('shows RERANK_TOP_N when re-ranking is enabled', () => {
    renderWithProviders(<SettingsPanel />);
    expect(screen.queryByText('RERANK_TOP_N')).toBeNull();
    fireEvent.click(screen.getByLabelText('Toggle re-ranking'));
    expect(screen.getByText('RERANK_TOP_N')).toBeDefined();
  });

  it('resets draft when reset button is clicked', () => {
    renderWithProviders(<SettingsPanel />);
    fireEvent.click(screen.getByLabelText('Toggle hybrid search'));
    expect((screen.getByLabelText('Save configuration changes') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByLabelText('Reset to last saved values'));
    expect((screen.getByLabelText('Save configuration changes') as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls mutate when save is clicked', () => {
    renderWithProviders(<SettingsPanel />);
    fireEvent.click(screen.getByLabelText('Toggle hybrid search'));
    fireEvent.click(screen.getByLabelText('Save configuration changes'));
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it('renders theme toggle', () => {
    renderWithProviders(<SettingsPanel />);
    expect(screen.getByLabelText('Switch to light mode')).toBeDefined();
  });
});
