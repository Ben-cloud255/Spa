'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const ROLE_HOME: Record<string, string> = {
  admin: '/admin',
  receptionist: '/receptionist',
  provider: '/provider',
};

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    } else {
      router.replace(ROLE_HOME[user.role] || '/login');
    }
  }, [user, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-forest-500">
      <p className="font-display text-lg italic">Preparing your workspace…</p>
    </div>
  );
}
