'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Branch } from '@/lib/types';

export function useBranches(includeInactive = false) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const query = includeInactive ? '?includeInactive=true' : '';
    api.get<{ branches: Branch[] }>(`/branches${query}`).then((d) => {
      setBranches(d.branches);
      setLoading(false);
    });
  }, [includeInactive]);

  return { branches, loading };
}
