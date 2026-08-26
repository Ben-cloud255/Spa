'use client';

import { useBranches } from '@/lib/useBranches';

export default function BranchFilter({
  value,
  onChange,
}: {
  value: string; // '' means "all branches"
  onChange: (branchId: string) => void;
}) {
  const { branches } = useBranches();

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-forest-200 px-3 py-2 text-sm bg-white"
    >
      <option value="">All branches</option>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
