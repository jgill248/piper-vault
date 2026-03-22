import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

interface LoginPageProps {
  onNavigateToRegister: () => void;
}

/**
 * Full-page login form using Obsidian Protocol design language.
 * Deep obsidian background, monospace typography, phosphor green accent (#abd600).
 * No rounded corners, no drop shadows.
 */
export function LoginPage({ onNavigateToRegister }: LoginPageProps) {
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ username, password });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen bg-obsidian-base flex items-center justify-center"
      style={{ background: '#05070A' }}
    >
      {/* Scanline overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(171,214,0,0.15) 1px, rgba(171,214,0,0.15) 2px)',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-sm px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="font-mono text-[10px] text-[#abd600] uppercase tracking-[0.3em] mb-1">
            Delve — Knowledge Base
          </div>
          <h1
            className="font-mono text-xl uppercase tracking-wider"
            style={{ color: '#e8edf2' }}
          >
            Sign In
          </h1>
          <div
            className="mt-2 font-mono text-[9px] uppercase tracking-widest"
            style={{ color: '#4a5568' }}
          >
            Enter your credentials to access your knowledge base
          </div>
        </div>

        {/* Form card */}
        <div
          className="border p-6"
          style={{ borderColor: '#1a2030', background: '#080b10' }}
        >
          {/* Top accent bar */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{ background: '#abd600', opacity: 0.6 }}
          />

          <form onSubmit={handleSubmit} noValidate>
            {/* Username field */}
            <div className="mb-4">
              <label
                htmlFor="login-username"
                className="block font-mono text-[9px] uppercase tracking-widest mb-1.5"
                style={{ color: '#4a5568' }}
              >
                Username
              </label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isSubmitting}
                className="w-full px-3 py-2 font-mono text-xs outline-none disabled:opacity-50"
                style={{
                  background: '#05070A',
                  border: '1px solid #1a2030',
                  color: '#c8d4e0',
                  borderRadius: 0,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#abd600';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#1a2030';
                }}
              />
            </div>

            {/* Password field */}
            <div className="mb-5">
              <label
                htmlFor="login-password"
                className="block font-mono text-[9px] uppercase tracking-widest mb-1.5"
                style={{ color: '#4a5568' }}
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isSubmitting}
                className="w-full px-3 py-2 font-mono text-xs outline-none disabled:opacity-50"
                style={{
                  background: '#05070A',
                  border: '1px solid #1a2030',
                  color: '#c8d4e0',
                  borderRadius: 0,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#abd600';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#1a2030';
                }}
              />
            </div>

            {/* Error message */}
            {error && (
              <div
                className="mb-4 px-3 py-2 font-mono text-[10px] border"
                style={{
                  color: '#e85555',
                  borderColor: '#e85555',
                  background: 'rgba(232,85,85,0.05)',
                }}
                role="alert"
              >
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting || !username || !password}
              className="w-full py-2.5 font-mono text-[10px] uppercase tracking-widest transition-opacity disabled:opacity-40"
              style={{
                background: '#abd600',
                color: '#05070A',
                border: 'none',
                cursor: isSubmitting ? 'wait' : 'pointer',
                borderRadius: 0,
              }}
            >
              {isSubmitting ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Register link */}
        <div className="mt-4 text-center">
          <span
            className="font-mono text-[9px] uppercase tracking-widest"
            style={{ color: '#4a5568' }}
          >
            No account?{' '}
          </span>
          <button
            type="button"
            onClick={onNavigateToRegister}
            className="font-mono text-[9px] uppercase tracking-widest transition-colors"
            style={{ color: '#abd600', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Register
          </button>
        </div>
      </div>
    </div>
  );
}
