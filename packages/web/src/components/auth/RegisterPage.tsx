import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

interface RegisterPageProps {
  onNavigateToLogin: () => void;
}

/**
 * Full-page registration form using Sovereign Press design language.
 * Parchment background, crimson primary accent.
 * No rounded corners, no drop shadows.
 */
export function RegisterPage({ onNavigateToLogin }: RegisterPageProps) {
  const { register } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        username,
        password,
        email: email.trim() !== '' ? email.trim() : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = 'var(--color-primary)';
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = 'var(--color-outline)';
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-sm px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="font-label text-[10px] text-primary uppercase tracking-[0.3em] mb-1">
            P.I.P.E.R. Vault
          </div>
          <h1 className="font-headline text-xl text-on-surface uppercase tracking-wider">
            Create Account
          </h1>
          <div className="mt-2 font-label text-[9px] text-on-surface-variant uppercase tracking-widest">
            Set up your personal knowledge base
          </div>
        </div>

        {/* Form card */}
        <div className="relative border border-outline-variant bg-surface-container-low p-6">
          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-px bg-primary opacity-60" />

          <form onSubmit={handleSubmit} noValidate>
            {/* Username */}
            <div className="mb-4">
              <label
                htmlFor="reg-username"
                className="block font-label text-[9px] text-on-surface-variant uppercase tracking-widest mb-1.5"
              >
                Username
              </label>
              <input
                id="reg-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isSubmitting}
                className="input-cmd disabled:opacity-50"
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
              <p className="mt-1 font-label text-[8px] text-on-surface-variant uppercase tracking-widest">
                Letters, numbers, underscores, hyphens only
              </p>
            </div>

            {/* Email (optional) */}
            <div className="mb-4">
              <label
                htmlFor="reg-email"
                className="block font-label text-[9px] text-on-surface-variant uppercase tracking-widest mb-1.5"
              >
                Email <span className="opacity-50">(optional)</span>
              </label>
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="input-cmd disabled:opacity-50"
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* Password */}
            <div className="mb-4">
              <label
                htmlFor="reg-password"
                className="block font-label text-[9px] text-on-surface-variant uppercase tracking-widest mb-1.5"
              >
                Password
              </label>
              <input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isSubmitting}
                className="input-cmd disabled:opacity-50"
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
              <p className="mt-1 font-label text-[8px] text-on-surface-variant uppercase tracking-widest">
                Minimum 8 characters
              </p>
            </div>

            {/* Confirm password */}
            <div className="mb-5">
              <label
                htmlFor="reg-confirm"
                className="block font-label text-[9px] text-on-surface-variant uppercase tracking-widest mb-1.5"
              >
                Confirm Password
              </label>
              <input
                id="reg-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isSubmitting}
                className="input-cmd disabled:opacity-50"
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* Error */}
            {error && (
              <div
                className="mb-4 px-3 py-2 font-label text-[10px] border text-error border-error bg-error-container/10"
                role="alert"
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !username || !password || !confirmPassword}
              className="btn-primary w-full py-2.5 disabled:opacity-40"
            >
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        </div>

        {/* Login link */}
        <div className="mt-4 text-center">
          <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest">
            Already have an account?{' '}
          </span>
          <button
            type="button"
            onClick={onNavigateToLogin}
            className="font-label text-[9px] text-primary uppercase tracking-widest bg-transparent border-none cursor-pointer p-0"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
