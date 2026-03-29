import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

interface LoginPageProps {
  onNavigateToRegister: () => void;
}

/**
 * Full-page login form using Sovereign Press design language.
 * Parchment background, crimson primary accent.
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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-sm px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="font-label text-[10px] text-primary uppercase tracking-[0.3em] mb-1">
            Delve — Knowledge Base
          </div>
          <h1 className="font-headline text-xl text-on-surface uppercase tracking-wider">
            Sign In
          </h1>
          <div className="mt-2 font-label text-[9px] text-on-surface-variant uppercase tracking-widest">
            Enter your credentials to access your knowledge base
          </div>
        </div>

        {/* Form card */}
        <div className="relative border border-outline-variant bg-surface-container-low p-6">
          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-px bg-primary opacity-60" />

          <form onSubmit={handleSubmit} noValidate>
            {/* Username field */}
            <div className="mb-4">
              <label
                htmlFor="login-username"
                className="block font-label text-[9px] text-on-surface-variant uppercase tracking-widest mb-1.5"
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
                className="input-cmd disabled:opacity-50"
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-outline)';
                }}
              />
            </div>

            {/* Password field */}
            <div className="mb-5">
              <label
                htmlFor="login-password"
                className="block font-label text-[9px] text-on-surface-variant uppercase tracking-widest mb-1.5"
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
                className="input-cmd disabled:opacity-50"
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-outline)';
                }}
              />
            </div>

            {/* Error message */}
            {error && (
              <div
                className="mb-4 px-3 py-2 font-label text-[10px] border text-error border-error bg-error-container/10"
                role="alert"
              >
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting || !username || !password}
              className="btn-primary w-full py-2.5 disabled:opacity-40"
            >
              {isSubmitting ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Register link */}
        <div className="mt-4 text-center">
          <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest">
            No account?{' '}
          </span>
          <button
            type="button"
            onClick={onNavigateToRegister}
            className="font-label text-[9px] text-primary uppercase tracking-widest bg-transparent border-none cursor-pointer p-0"
          >
            Register
          </button>
        </div>
      </div>
    </div>
  );
}
