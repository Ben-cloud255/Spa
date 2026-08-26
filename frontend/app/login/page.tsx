'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import PasswordInput from '@/components/PasswordInput';
import Image from 'next/image';

const ROLE_HOME: Record<string, string> = {
  admin: '/admin',
  receptionist: '/receptionist',
  provider: '/provider',
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
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      router.replace(ROLE_HOME[user.role] || '/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-forest-700 text-sand-50 p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]" aria-hidden>
          <svg width="100%" height="100%" viewBox="0 0 400 400" fill="none">
            <path d="M0 200 Q 100 140 200 200 T 400 200" stroke="currentColor" strokeWidth="1" />
            <path d="M0 260 Q 100 200 200 260 T 400 260" stroke="currentColor" strokeWidth="1" />
            <path d="M0 320 Q 100 260 200 320 T 400 320" stroke="currentColor" strokeWidth="1" />
          </svg>
        </div>
        <div className="relative z-10">
          <p className="uppercase tracking-[0.3em] text-xs text-forest-200">Staff Portal</p>
          <h1 className="font-display italic text-5xl mt-4 leading-tight">Serene Spa</h1>
        </div>
        <div className="relative z-10 space-y-4">
          <div className="aspect-[4/3] w-full rounded-xl2 overflow-hidden">
  <Image
    src="/spa3.jpg"
    alt="Serene Spa"
    width={800}
    height={600}
    className="w-full h-full object-cover"
    priority
  />
</div>
          <p className="text-forest-100 text-sm max-w-sm">
            Rooms, bookings, and every service session — tracked in one calm, reliable place.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 text-center">
            <h1 className="font-display italic text-3xl text-forest-700">Serene Spa</h1>
          </div>
          <h2 className="font-display text-2xl text-ink mb-1">Welcome</h2>
          <p className="text-forest-500/80 text-sm mb-8">Sign in with the account your admin set up for you.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-forest-200 bg-white px-3.5 py-2.5 text-sm focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
                placeholder="you@serenespa.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink mb-1.5">
                Password
              </label>
              <PasswordInput
                id="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-forest-200 bg-white px-3.5 py-2.5 text-sm focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-clay bg-clay/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-forest-600 text-sand-50 font-medium py-2.5 text-sm hover:bg-forest-700 transition-colors disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-xs text-forest-500/60 mt-8">
            Lost your password? Ask your admin to reset it from the Staff Accounts page.
          </p>
        </div>
      </div>
    </div>
  );
}
