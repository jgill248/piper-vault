import { useState } from 'react';
import type { ApiKey } from '../../api/client';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '../../hooks/use-api-keys';
import { useCollections } from '../../hooks/use-collections';
import { DEFAULT_COLLECTION_ID } from '@delve/shared';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return 'Never';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

interface CreatedKeyBannerProps {
  fullKey: string;
  onDismiss: () => void;
}

function CreatedKeyBanner({ fullKey, onDismiss }: CreatedKeyBannerProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(fullKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="border border-yellow-400/40 bg-yellow-400/5 p-3 mb-4">
      <p className="font-label text-[9px] text-yellow-400 uppercase tracking-widest mb-2">
        KEY_CREATED — COPY NOW — NOT SHOWN AGAIN
      </p>
      <div className="flex items-center gap-2 min-w-0">
        <code className="flex-1 min-w-0 font-label text-[10px] text-primary bg-background px-2 py-1.5 overflow-x-auto whitespace-nowrap">
          {fullKey}
        </code>
        <button
          onClick={handleCopy}
          className="shrink-0 border border-outline-variant px-2 py-1.5 font-label text-[9px] uppercase tracking-widest text-secondary hover:border-primary hover:text-primary transition-colors"
          aria-label="Copy API key"
        >
          {copied ? 'COPIED' : 'COPY_'}
        </button>
        <button
          onClick={onDismiss}
          className="shrink-0 border border-outline-variant px-2 py-1.5 font-label text-[9px] uppercase tracking-widest text-secondary hover:border-red-400 hover:text-red-400 transition-colors"
          aria-label="Dismiss key banner"
        >
          DISMISS_
        </button>
      </div>
    </div>
  );
}

interface ApiKeyRowItemProps {
  apiKey: ApiKey;
  collectionName: string;
  onRevoke: (id: string) => void;
  isRevoking: boolean;
}

function ApiKeyRowItem({ apiKey, collectionName, onRevoke, isRevoking }: ApiKeyRowItemProps) {
  const [confirming, setConfirming] = useState(false);

  function handleRevokeClick() {
    if (confirming) {
      onRevoke(apiKey.id);
      setConfirming(false);
    } else {
      setConfirming(true);
    }
  }

  return (
    <div className="flex items-start justify-between py-2.5 border-b border-outline-variant/10 last:border-0 gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-label text-[11px] text-on-surface truncate">{apiKey.name}</span>
          <code className="font-label text-[9px] text-primary bg-background px-1.5 py-0.5 shrink-0">
            {apiKey.prefix}...
          </code>
        </div>
        <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
          <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest truncate max-w-full">
            {collectionName}
          </span>
          <span className="font-label text-[9px] text-on-surface-variant whitespace-nowrap">
            Created {formatDate(apiKey.createdAt)}
          </span>
          <span className="font-label text-[9px] text-on-surface-variant whitespace-nowrap">
            Used {formatDate(apiKey.lastUsedAt)}
          </span>
          {apiKey.expiresAt && (
            <span className={`font-label text-[9px] whitespace-nowrap ${new Date(apiKey.expiresAt) < new Date() ? 'text-red-400' : 'text-on-surface-variant'}`}>
              Expires {formatDate(apiKey.expiresAt)}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {confirming && (
          <span className="font-label text-[9px] text-red-400 uppercase tracking-widest">
            CONFIRM?
          </span>
        )}
        <button
          onClick={handleRevokeClick}
          disabled={isRevoking}
          onBlur={() => setTimeout(() => setConfirming(false), 200)}
          className={`border px-2 py-1 font-label text-[9px] uppercase tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            confirming
              ? 'border-red-400 text-red-400 bg-red-400/5'
              : 'border-outline-variant text-on-surface-variant hover:border-red-400 hover:text-red-400'
          }`}
          aria-label={confirming ? 'Confirm revoke' : `Revoke API key ${apiKey.name}`}
        >
          {isRevoking ? 'REVOKING...' : confirming ? 'REVOKE_' : 'REVOKE'}
        </button>
      </div>
    </div>
  );
}

interface CreateApiKeyFormProps {
  collectionOptions: { value: string; label: string }[];
  onCreated: (fullKey: string) => void;
}

function CreateApiKeyForm({ collectionOptions, onCreated }: CreateApiKeyFormProps) {
  const [name, setName] = useState('');
  const [collectionId, setCollectionId] = useState(DEFAULT_COLLECTION_ID);
  const [expiresAt, setExpiresAt] = useState('');
  const createApiKey = useCreateApiKey();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || createApiKey.isPending) return;

    createApiKey.mutate(
      {
        name: trimmedName,
        collectionId,
        expiresAt: expiresAt || undefined,
      },
      {
        onSuccess: (response) => {
          setName('');
          setExpiresAt('');
          onCreated(response.key);
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="py-3 space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest block mb-1">
            KEY_NAME
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-automation"
            maxLength={200}
            className="w-full bg-surface-container border-b border-outline-variant font-label text-[11px] text-primary px-2 py-1 outline-none focus:border-primary transition-colors"
            aria-label="API key name"
          />
        </div>
        <div>
          <label className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest block mb-1">
            COLLECTION
          </label>
          <select
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
            className="w-full bg-surface-container border-b border-outline-variant font-label text-[11px] text-primary px-2 py-1 outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
            aria-label="Target collection"
          >
            {collectionOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-surface-container-high">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest block mb-1">
            EXPIRES_AT (optional)
          </label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value ? new Date(e.target.value).toISOString() : '')}
            className="w-full bg-surface-container border-b border-outline-variant font-label text-[11px] text-secondary px-2 py-1 outline-none focus:border-primary transition-colors"
            aria-label="Key expiry date"
          />
        </div>
        <button
          type="submit"
          disabled={!name.trim() || createApiKey.isPending}
          className="btn-primary text-[9px] px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none shrink-0"
        >
          {createApiKey.isPending ? 'GENERATING...' : 'GENERATE_KEY_'}
        </button>
      </div>
      {createApiKey.isError && (
        <p className="font-label text-[9px] text-red-400">
          {createApiKey.error instanceof Error ? createApiKey.error.message : 'Failed to create key'}
        </p>
      )}
    </form>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Webhook docs sub-section
// ────────────────────────────────────────────────────────────────────────────

function WebhookDocs() {
  const baseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}/api/v1` : 'http://localhost:3001/api/v1';
  const [copied, setCopied] = useState<string | null>(null);

  function handleCopy(text: string, key: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const curlJson = `curl -X POST ${baseUrl}/webhooks/ingest \\
  -H "X-API-Key: dlv_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "filename": "notes.md",
    "content": "# My Notes\\nThis is some content...",
    "tags": ["notes", "meeting"]
  }'`;

  const curlUrl = `curl -X POST ${baseUrl}/webhooks/ingest/url \\
  -H "X-API-Key: dlv_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://example.com/document.txt",
    "tags": ["web"]
  }'`;

  return (
    <div className="py-3 space-y-3">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest">
            ENDPOINT_URL
          </span>
        </div>
        <code className="block font-label text-[10px] text-primary bg-background px-2 py-1.5">
          {baseUrl}/webhooks/ingest
        </code>
      </div>

      <div>
        <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest block mb-1">
          AUTH_HEADER
        </span>
        <code className="block font-label text-[10px] text-primary bg-background px-2 py-1.5">
          X-API-Key: dlv_your_key_here
        </code>
        <p className="font-label text-[9px] text-on-surface-variant mt-0.5">
          Also accepts: Authorization: Bearer dlv_your_key_here
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest">
            INGEST_TEXT_CONTENT
          </span>
          <button
            onClick={() => handleCopy(curlJson, 'json')}
            className="font-label text-[9px] text-on-surface-variant hover:text-primary transition-colors"
            aria-label="Copy curl example for text ingestion"
          >
            {copied === 'json' ? 'COPIED' : 'COPY_'}
          </button>
        </div>
        <pre className="font-label text-[9px] text-secondary bg-background px-2 py-1.5 overflow-x-auto whitespace-pre-wrap leading-relaxed">
          {curlJson}
        </pre>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest">
            INGEST_FROM_URL
          </span>
          <button
            onClick={() => handleCopy(curlUrl, 'url')}
            className="font-label text-[9px] text-on-surface-variant hover:text-primary transition-colors"
            aria-label="Copy curl example for URL ingestion"
          >
            {copied === 'url' ? 'COPIED' : 'COPY_'}
          </button>
        </div>
        <pre className="font-label text-[9px] text-secondary bg-background px-2 py-1.5 overflow-x-auto whitespace-pre-wrap leading-relaxed">
          {curlUrl}
        </pre>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main exported section
// ────────────────────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  index: string;
  title: string;
}

function SectionHeader({ index, title }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="font-label text-[9px] text-primary uppercase tracking-widest">{index}</span>
      <span className="font-label text-[10px] text-secondary uppercase tracking-wider">{title}</span>
      <div className="flex-1 h-px bg-outline-variant/20" />
    </div>
  );
}

export function ApiKeysSection({ sectionIndex }: { sectionIndex: string }) {
  const { data: apiKeysList, isLoading } = useApiKeys();
  const { data: collectionsData } = useCollections();
  const revokeApiKey = useRevokeApiKey();
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  const collections = collectionsData?.data ?? [];

  const collectionOptions = collections.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  if (collectionOptions.length === 0) {
    collectionOptions.push({ value: DEFAULT_COLLECTION_ID, label: 'Default' });
  }

  function getCollectionName(collectionId: string): string {
    return collections.find((c) => c.id === collectionId)?.name ?? 'Unknown';
  }

  const webhookSectionIndex = String(parseInt(sectionIndex, 10) + 1).padStart(2, '0');

  return (
    <>
      {/* API Keys section */}
      <div className="mb-6">
        <SectionHeader index={sectionIndex} title="API_KEYS" />

        <div className="bg-surface-container border border-outline-variant/20 px-3">
          {newlyCreatedKey && (
            <CreatedKeyBanner
              fullKey={newlyCreatedKey}
              onDismiss={() => setNewlyCreatedKey(null)}
            />
          )}

          {/* Create form */}
          <CreateApiKeyForm
            collectionOptions={collectionOptions}
            onCreated={(key) => setNewlyCreatedKey(key)}
          />

          {/* Divider */}
          <div className="border-t border-outline-variant/20 my-1" />

          {/* Key list */}
          {isLoading ? (
            <div className="py-4 text-center">
              <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest animate-pulse">
                LOADING...
              </span>
            </div>
          ) : !apiKeysList || apiKeysList.length === 0 ? (
            <div className="py-4 text-center">
              <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest">
                NO_KEYS_CONFIGURED
              </span>
            </div>
          ) : (
            <div>
              {apiKeysList.map((key) => (
                <ApiKeyRowItem
                  key={key.id}
                  apiKey={key}
                  collectionName={getCollectionName(key.collectionId)}
                  onRevoke={(id) => revokeApiKey.mutate(id)}
                  isRevoking={revokeApiKey.isPending && revokeApiKey.variables === key.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Webhook docs section */}
      <div className="mb-6">
        <SectionHeader index={webhookSectionIndex} title="WEBHOOK_ENDPOINTS" />

        <div className="bg-surface-container border border-outline-variant/20 px-3">
          <WebhookDocs />
        </div>
      </div>
    </>
  );
}
