'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { Role } from '@/lib/types';

export default function RoleGuard({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    } else if (!allow.includes(user.role)) {
      router.replace('/');
    }
  }, [user, loading, allow, router]);

  if (loading || !user || !allow.includes(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-forest-500">
        <p className="font-display italic text-lg">Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
