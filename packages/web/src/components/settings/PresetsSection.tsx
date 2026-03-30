import { useState } from 'react';
import { DEFAULT_PRESET_ID } from '@delve/shared';
import type { SystemPromptPreset } from '@delve/shared';
import {
  usePresets,
  useCreatePreset,
  useUpdatePreset,
  useDeletePreset,
} from '../../hooks/use-presets';
import { useConfig, useUpdateConfig } from '../../hooks/use-config';

function PresetCard({
  preset,
  isActive,
  onActivate,
  onUpdate,
  onDelete,
}: {
  preset: SystemPromptPreset;
  isActive: boolean;
  onActivate: () => void;
  onUpdate: (input: { name?: string; persona?: string; model?: string | null }) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(preset.name);
  const [persona, setPersona] = useState(preset.persona);
  const [model, setModel] = useState(preset.model ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleSave() {
    onUpdate({
      name: name !== preset.name ? name : undefined,
      persona: persona !== preset.persona ? persona : undefined,
      model: model !== (preset.model ?? '') ? (model || null) : undefined,
    });
    setEditing(false);
  }

  function handleCancel() {
    setName(preset.name);
    setPersona(preset.persona);
    setModel(preset.model ?? '');
    setEditing(false);
    setConfirmDelete(false);
  }

  return (
    <div
      className={`border px-3 py-2.5 mb-2 transition-all duration-100 ${
        isActive
          ? 'border-primary/40 bg-primary/5'
          : 'border-outline-variant/20 hover:border-outline-variant/40'
      }`}
    >
      {!editing ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={onActivate}
                className={`w-3 h-3 border shrink-0 transition-all duration-100 ${
                  isActive
                    ? 'bg-primary-container border-primary'
                    : 'bg-transparent border-outline-variant hover:border-primary'
                }`}
                aria-label={`Activate preset ${preset.name}`}
                aria-pressed={isActive}
              />
              <span className="font-label text-[11px] text-on-surface truncate">
                {preset.name}
              </span>
              {isActive && (
                <span className="font-label text-[8px] text-primary uppercase tracking-wider shrink-0">
                  ACTIVE
                </span>
              )}
              {preset.model && (
                <span className="font-label text-[8px] text-secondary uppercase tracking-wider border border-outline-variant/30 px-1.5 py-0.5 shrink-0">
                  {preset.model}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setEditing(true)}
                className="font-label text-[8px] text-secondary uppercase tracking-wider hover:text-primary transition-colors px-1.5 py-0.5"
              >
                EDIT
              </button>
              {!preset.isDefault && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="font-label text-[8px] text-secondary uppercase tracking-wider hover:text-red-400 transition-colors px-1.5 py-0.5"
                >
                  DEL
                </button>
              )}
            </div>
          </div>
          {preset.persona && (
            <p className="font-body text-[10px] text-on-surface-variant mt-1.5 line-clamp-2 leading-relaxed pl-5">
              {preset.persona}
            </p>
          )}
          {confirmDelete && (
            <div className="flex items-center gap-2 mt-2 pl-5">
              <span className="font-label text-[9px] text-red-400 uppercase tracking-wider">
                DELETE_PRESET?
              </span>
              <button
                onClick={() => { onDelete(); setConfirmDelete(false); }}
                className="font-label text-[8px] text-red-400 uppercase tracking-wider border border-red-400/30 px-2 py-0.5 hover:bg-red-400/10 transition-colors"
              >
                CONFIRM
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="font-label text-[8px] text-secondary uppercase tracking-wider hover:text-primary transition-colors px-1.5 py-0.5"
              >
                CANCEL
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2">
          <div>
            <label className="font-label text-[9px] text-secondary uppercase tracking-widest block mb-1">
              NAME
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface-container border-b border-outline-variant font-label text-[11px] text-primary px-2 py-1 outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="font-label text-[9px] text-secondary uppercase tracking-widest block mb-1">
              PERSONA
            </label>
            <textarea
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              rows={6}
              placeholder="Instructions prepended to the core RAG system prompt. Shape the assistant's tone, verbosity, domain focus, or model-specific behavior..."
              className="w-full bg-surface-container border border-outline-variant/30 font-body text-[11px] text-on-surface px-2 py-1.5 outline-none focus:border-primary transition-colors resize-y leading-relaxed placeholder:text-on-surface-variant/50"
            />
          </div>
          <div>
            <label className="font-label text-[9px] text-secondary uppercase tracking-widest block mb-1">
              MODEL_OVERRIDE
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Optional — e.g. claude-3.5-sonnet, gpt-4o"
              className="w-full bg-surface-container border-b border-outline-variant font-label text-[11px] text-primary px-2 py-1 outline-none focus:border-primary transition-colors placeholder:text-on-surface-variant/50"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="btn-primary text-[9px] px-3 py-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              SAVE
            </button>
            <button
              onClick={handleCancel}
              className="btn-secondary text-[9px] px-3 py-1"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PresetsSection() {
  const { data: presets, isLoading } = usePresets();
  const { data: config } = useConfig();
  const updateConfig = useUpdateConfig();
  const createPreset = useCreatePreset();
  const updatePreset = useUpdatePreset();
  const deletePreset = useDeletePreset();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPersona, setNewPersona] = useState('');
  const [newModel, setNewModel] = useState('');

  const activePresetId = config?.activePresetId ?? DEFAULT_PRESET_ID;

  function handleActivate(id: string) {
    if (id !== activePresetId) {
      updateConfig.mutate({ activePresetId: id } as Partial<typeof config & { activePresetId: string }>);
    }
  }

  function handleCreate() {
    if (!newName.trim()) return;
    createPreset.mutate(
      {
        name: newName.trim(),
        persona: newPersona,
        model: newModel || undefined,
      },
      {
        onSuccess: () => {
          setNewName('');
          setNewPersona('');
          setNewModel('');
          setShowCreate(false);
        },
      },
    );
  }

  const sectionId = 'system-prompt-presets';
  return (
    <div className="mb-6" id={`section-${sectionId}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="font-label text-[10px] text-secondary uppercase tracking-wider">
          SYSTEM_PROMPT_PRESETS
        </span>
        <div className="flex-1 h-px bg-outline-variant/20" />
      </div>
      <div className="bg-surface-container border border-outline-variant/20 px-3 py-3">
        <p className="font-body text-[10px] text-on-surface-variant mb-3 leading-relaxed">
          Persona instructions prepended to the core RAG system prompt. Use presets to tune behavior
          per model without changing code. The core citation and grounding rules are always applied.
        </p>

        {isLoading ? (
          <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-wider animate-pulse">
            LOADING...
          </span>
        ) : (
          <>
            {presets?.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                isActive={preset.id === activePresetId}
                onActivate={() => handleActivate(preset.id)}
                onUpdate={(input) =>
                  updatePreset.mutate({ id: preset.id, input })
                }
                onDelete={() => deletePreset.mutate(preset.id)}
              />
            ))}

            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                className="font-label text-[9px] text-secondary uppercase tracking-wider hover:text-primary transition-colors border border-dashed border-outline-variant/30 hover:border-primary/30 w-full py-2 mt-1"
              >
                + NEW_PRESET
              </button>
            ) : (
              <div className="border border-primary/20 bg-primary/5 px-3 py-2.5 mt-1 space-y-2">
                <div>
                  <label className="font-label text-[9px] text-secondary uppercase tracking-widest block mb-1">
                    NAME
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Claude Research, GPT-4 Concise"
                    className="w-full bg-surface-container border-b border-outline-variant font-label text-[11px] text-primary px-2 py-1 outline-none focus:border-primary transition-colors placeholder:text-on-surface-variant/50"
                  />
                </div>
                <div>
                  <label className="font-label text-[9px] text-secondary uppercase tracking-widest block mb-1">
                    PERSONA
                  </label>
                  <textarea
                    value={newPersona}
                    onChange={(e) => setNewPersona(e.target.value)}
                    rows={6}
                    placeholder="Instructions prepended to the core RAG system prompt. Shape the assistant's tone, verbosity, domain focus, or model-specific behavior..."
                    className="w-full bg-surface-container border border-outline-variant/30 font-body text-[11px] text-on-surface px-2 py-1.5 outline-none focus:border-primary transition-colors resize-y leading-relaxed placeholder:text-on-surface-variant/50"
                  />
                </div>
                <div>
                  <label className="font-label text-[9px] text-secondary uppercase tracking-widest block mb-1">
                    MODEL_OVERRIDE
                  </label>
                  <input
                    type="text"
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    placeholder="Optional — e.g. claude-3.5-sonnet, gpt-4o"
                    className="w-full bg-surface-container border-b border-outline-variant font-label text-[11px] text-primary px-2 py-1 outline-none focus:border-primary transition-colors placeholder:text-on-surface-variant/50"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleCreate}
                    disabled={!newName.trim() || createPreset.isPending}
                    className="btn-primary text-[9px] px-3 py-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {createPreset.isPending ? 'CREATING...' : 'CREATE'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreate(false);
                      setNewName('');
                      setNewPersona('');
                      setNewModel('');
                    }}
                    className="btn-secondary text-[9px] px-3 py-1"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
