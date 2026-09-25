'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import PasswordInput from '@/components/PasswordInput';

const ROLE_HOME: Record<string, string> = {
  admin: '/admin', receptionist: '/receptionist', provider: '/provider',
};

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      router.replace(ROLE_HOME[user.role] || '/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="staff-login">
      <header className="staff-login-header">
        <div className="staff-login-brand"><span className="staff-login-monogram" aria-hidden="true">S</span><div><p>Serene Spa</p><span>MANAGEMENT SYSTEM</span></div></div>
        <span className="staff-login-header-label">Staff portal</span>
      </header>
      <main className="staff-login-main">
        <section className="staff-login-card" aria-labelledby="login-heading">
          <div className="staff-login-intro">
            <span className="staff-login-icon" aria-hidden="true"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3" strokeLinecap="round"/></svg></span>
            <p className="staff-login-eyebrow">YOUR WORKSPACE AWAITS</p>
            <h1 id="login-heading">Sign in to your account</h1>
            <p className="staff-login-description">Welcome back. Enter your staff credentials to continue.</p>
          </div>
          <form onSubmit={handleSubmit} className="staff-login-form" aria-busy={submitting}>
            <div>
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" required autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={e => setEmail(e.target.value)} className="staff-login-input" placeholder="you@serenespa.com" readOnly={submitting} />
            </div>
            <div>
              <label htmlFor="password">Password</label>
              <PasswordInput id="password" name="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="staff-login-input" placeholder="Enter your password" readOnly={submitting} />
            </div>
            {error && <p role="alert" className="staff-login-error">{error}</p>}
            <button type="submit" disabled={submitting} className="staff-login-submit"><span>{submitting ? 'Signing in…' : 'Sign in'}</span>{!submitting && <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 12h14m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round"/></svg>}</button>
          </form>
          <div className="staff-login-help"><p>Need help signing in?</p><span>Contact your administrator for account access or a password reset.</span></div>
        </section>
        <p className="staff-login-access">For authorized Serene Spa staff only.</p>
      </main>
      <footer className="staff-login-footer"><span>Serene Spa</span><span>One workspace. Every detail.</span></footer>
    </div>
  );
}
